import logging
from typing import Dict, Any, List
# pyrefly: ignore [missing-import]
from ortools.constraint_solver import pywrapcp
# pyrefly: ignore [missing-import]
from ortools.constraint_solver import routing_enums_pb2

from app.models import OptimizeRequest, OptimizeResponse, VehicleRoute, RouteItem
from app.distance import build_distance_matrix

logger = logging.getLogger(__name__)

def distance_to_travel_time(distance_meters: int) -> int:
    """
    Helper to convert distance (meters) to travel duration (minutes)
    assuming an average speed of 30 km/h (500 meters per minute) in traffic.
    """
    if distance_meters == 0:
        return 0
    return max(1, int(round(distance_meters / 500.0)))

def solve_vrp(payload: OptimizeRequest) -> OptimizeResponse:
    # Scale factors to convert floats to integers for OR-Tools
    WEIGHT_SCALE = 1000         # kg to grams (keeps 3 decimals)
    VOLUME_SCALE = 1000000      # cbm to cc (keeps 6 decimals)

    # 1. Prepare points (Depot is index 0, orders are 1 to N)
    depot = payload.depot
    vehicles = payload.vehicles
    orders = payload.orders

    points = [{"lat": depot.lat, "lng": depot.lng}]
    for order in orders:
        points.append({"lat": order.lat, "lng": order.lng})

    # 2. Build Distance Matrix
    distance_matrix = build_distance_matrix(points)
    
    num_nodes = len(points)
    num_vehicles = len(vehicles)
    depot_index = 0

    # 3. Create routing model manager
    manager = pywrapcp.RoutingIndexManager(
        num_nodes,
        num_vehicles,
        depot_index
    )
    routing = pywrapcp.RoutingModel(manager)

    # 4. Register Transit (Distance) Callback and Vehicle-Specific Cost Callbacks
    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)

    # Register vehicle-specific cost callbacks to minimize total monetary cost
    # Cost is scaled by 1000 to keep integer precision. Cost_scaled = round(distance_meters * cost_per_km).
    for vehicle_idx, vehicle in enumerate(vehicles):
        cost_per_km = vehicle.cost_per_km
        
        def make_cost_callback(v_cost_per_km: float):
            def vehicle_cost_callback(from_index: int, to_index: int) -> int:
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                dist = distance_matrix[from_node][to_node]
                return int(round(dist * v_cost_per_km))
            return vehicle_cost_callback

        cost_callback = make_cost_callback(cost_per_km)
        cost_callback_index = routing.RegisterTransitCallback(cost_callback)
        routing.SetArcCostEvaluatorOfVehicle(cost_callback_index, vehicle_idx)

    # 5a. Register Weight Callback & Dimension (Scaled to int)
    weights = [0] + [int(round(order.weight * WEIGHT_SCALE)) for order in orders]
    weight_capacities = [int(round(vehicle.weight_capacity * WEIGHT_SCALE)) for vehicle in vehicles]

    def weight_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return weights[from_node]

    weight_callback_index = routing.RegisterUnaryTransitCallback(weight_callback)
    
    routing.AddDimensionWithVehicleCapacity(
        weight_callback_index,
        0,  # null capacity slack
        weight_capacities,  # vehicle weight capacities
        True,  # start cumul to zero
        "Weight"
    )

    # 5b. Register Volume Callback & Dimension (Scaled to int)
    volumes = [0] + [int(round(order.volume * VOLUME_SCALE)) for order in orders]
    volume_capacities = [int(round(vehicle.volume_capacity * VOLUME_SCALE)) for vehicle in vehicles]

    def volume_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return volumes[from_node]

    volume_callback_index = routing.RegisterUnaryTransitCallback(volume_callback)
    
    routing.AddDimensionWithVehicleCapacity(
        volume_callback_index,
        0,  # null capacity slack
        volume_capacities,  # vehicle volume capacities
        True,  # start cumul to zero
        "Volume"
    )

    # 5c. Register Time Callback & Dimension (VRPTW)
    # Cost = travel time between nodes + service/unload time at departure node
    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        dist = distance_matrix[from_node][to_node]
        travel_time = distance_to_travel_time(dist)
        
        service_time = 0
        if from_node > 0:  # Depot departure has 0 service time
            service_time = orders[from_node - 1].service_time_min
        return travel_time + service_time

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    
    routing.AddDimension(
        time_callback_index,
        180,  # Max wait time allowed at stops (in minutes)
        1440, # Max total route duration (in minutes, i.e., 24 hours)
        False, # fix_start_cumul_to_zero must be False to allow start time flexibility
        "Time"
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    # Set Time bounds for vehicles (Start and End Shift times)
    for vehicle_idx, vehicle in enumerate(vehicles):
        start_var = time_dimension.CumulVar(routing.Start(vehicle_idx))
        end_var = time_dimension.CumulVar(routing.End(vehicle_idx))
        start_var.SetRange(vehicle.start_time_min, vehicle.end_time_min)
        end_var.SetRange(vehicle.start_time_min, vehicle.end_time_min)

    # Set Time bounds for orders (Convenient Delivery Windows)
    for node in range(1, num_nodes):
        order_idx = node - 1
        order = orders[order_idx]
        node_idx = manager.NodeToIndex(node)
        time_dimension.CumulVar(node_idx).SetRange(
            order.time_window_start_min,
            order.time_window_end_min
        )

    # 6a. Allow dropping nodes (Disjunctions) with priority-based penalties
    base_penalty = 1000000.0
    for node in range(1, num_nodes):
        order_idx = node - 1
        order = orders[order_idx]
        prio = max(1, order.priority)
        node_penalty = int(base_penalty * prio)
        routing.AddDisjunction([manager.NodeToIndex(node)], node_penalty)

    # 6b. Allowed Vehicles Constraints (Vehicle Compatibility)
    for node in range(1, num_nodes):
        order_idx = node - 1
        order = orders[order_idx]
        if order.allowed_vehicles:
            allowed_indices = []
            for v_id in order.allowed_vehicles:
                for idx, v in enumerate(vehicles):
                    if v.id == v_id:
                        allowed_indices.append(idx)
                        break
            if allowed_indices:
                routing.VehicleVar(manager.NodeToIndex(node)).SetValues(allowed_indices)

    # 7. Set search parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    # 5 seconds time limit
    search_parameters.time_limit.seconds = 5

    # 8. Solve VRP
    logger.info("Solving multi-dimensional VRP with priority, compatibility, and VRPTW constraints...")
    solution = routing.SolveWithParameters(search_parameters)

    # 9. Format response
    if not solution:
        logger.error("VRP Solver returned no solution.")
        return OptimizeResponse(
            status="FAILED",
            total_distance_meters=0,
            total_weight=0.0,
            total_volume=0.0,
            total_cost=0.0,
            routes=[],
            unassigned_orders=[order.id for order in orders]
        )

    routes = []
    total_distance_meters = 0
    total_weight = 0.0
    total_volume = 0.0
    assigned_orders_set = set()

    for vehicle_idx, vehicle in enumerate(vehicles):
        index = routing.Start(vehicle_idx)
        route_items = []
        route_distance = 0
        route_weight = 0.0
        route_volume = 0.0

        # Start time of the vehicle at depot
        arrival_time = solution.Value(time_dimension.CumulVar(index))

        # Start at depot
        depot_node = manager.IndexToNode(index)
        route_items.append(RouteItem(
            order_id="depot",
            lat=points[depot_node]["lat"],
            lng=points[depot_node]["lng"],
            weight=0.0,
            volume=0.0,
            priority=None,
            arrival_time_min=arrival_time,
            departure_time_min=arrival_time,
            cumulative_weight=0.0,
            cumulative_volume=0.0
        ))

        while not routing.IsEnd(index):
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            # Add distance from previous to current node
            from_node = manager.IndexToNode(previous_index)
            to_node = manager.IndexToNode(index)
            dist = distance_matrix[from_node][to_node]
            route_distance += dist

            # Get scheduled arrival time from Time dimension
            arrival_time = solution.Value(time_dimension.CumulVar(index))

            node = manager.IndexToNode(index)
            if node == 0:
                # Returned to depot
                route_items.append(RouteItem(
                    order_id="depot",
                    lat=points[node]["lat"],
                    lng=points[node]["lng"],
                    weight=0.0,
                    volume=0.0,
                    priority=None,
                    arrival_time_min=arrival_time,
                    departure_time_min=arrival_time,
                    cumulative_weight=route_weight,
                    cumulative_volume=route_volume
                ))
            else:
                # Visited order
                order_idx = node - 1
                order = orders[order_idx]
                route_weight += order.weight
                route_volume += order.volume
                assigned_orders_set.add(order.id)
                route_items.append(RouteItem(
                    order_id=order.id,
                    lat=order.lat,
                    lng=order.lng,
                    weight=order.weight,
                    volume=order.volume,
                    priority=order.priority,
                    arrival_time_min=arrival_time,
                    departure_time_min=arrival_time + order.service_time_min,
                    cumulative_weight=route_weight,
                    cumulative_volume=route_volume
                ))

        # Calculate trip duration and route cost
        trip_start_time = route_items[0].arrival_time_min
        trip_end_time = route_items[-1].arrival_time_min
        total_time_minutes = trip_end_time - trip_start_time
        route_cost = (route_distance / 1000.0) * vehicle.cost_per_km

        # Register route
        routes.append(VehicleRoute(
            vehicle_id=vehicle.id,
            weight_capacity=vehicle.weight_capacity,
            volume_capacity=vehicle.volume_capacity,
            total_weight=route_weight,
            total_volume=route_volume,
            total_distance_meters=route_distance,
            total_time_minutes=total_time_minutes,
            total_cost=route_cost,
            route=route_items
        ))
        total_distance_meters += route_distance
        total_weight += route_weight
        total_volume += route_volume

    # Find unassigned/dropped orders
    unassigned_orders = [o.id for o in orders if o.id not in assigned_orders_set]

    # Total fleet cost is the sum of individual vehicle route costs
    total_cost = sum(r.total_cost for r in routes)

    return OptimizeResponse(
        status="SUCCESS",
        total_distance_meters=total_distance_meters,
        total_weight=total_weight,
        total_volume=total_volume,
        total_cost=total_cost,
        routes=routes,
        unassigned_orders=unassigned_orders
    )




