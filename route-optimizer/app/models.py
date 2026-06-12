# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import List, Optional

class Location(BaseModel):
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")

class Vehicle(BaseModel):
    id: str = Field(..., description="Unique vehicle identifier")
    weight_capacity: float = Field(..., description="Maximum carrying weight capacity of the vehicle")
    volume_capacity: float = Field(..., description="Maximum carrying volume capacity of the vehicle")
    start_time_min: int = Field(..., description="Vehicle shift start time (in minutes from midnight, e.g., 480 for 08:00)")
    end_time_min: int = Field(..., description="Vehicle shift end time (in minutes from midnight, e.g., 1020 for 17:00)")
    cost_per_km: float = Field(default=1.0, description="Operating/fuel cost per kilometer for this vehicle")

class Order(BaseModel):
    id: str = Field(..., description="Unique delivery/order identifier")
    lat: float = Field(..., description="Latitude coordinate of the delivery location")
    lng: float = Field(..., description="Longitude coordinate of the delivery location")
    weight: float = Field(..., description="Weight of the delivery order")
    volume: float = Field(..., description="Volume of the delivery order")
    priority: int = Field(default=1, description="Delivery priority (higher numbers represent higher priority)")
    allowed_vehicles: Optional[List[str]] = Field(None, description="Optional list of vehicle IDs allowed to deliver this order")
    time_window_start_min: int = Field(..., description="Delivery window start time (in minutes from midnight)")
    time_window_end_min: int = Field(..., description="Delivery window end time (in minutes from midnight)")
    service_time_min: int = Field(default=15, description="Unloading/service time at delivery location (in minutes)")

class OptimizeRequest(BaseModel):
    depot: Location = Field(..., description="Starting and ending point coordinates for all vehicles")
    vehicles: List[Vehicle] = Field(..., description="List of available vehicles in the fleet")
    orders: List[Order] = Field(..., description="List of orders to be delivered")

class RouteItem(BaseModel):
    order_id: str = Field(..., description="ID of the order or 'depot' for return/start")
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")
    weight: float = Field(..., description="Weight delivered at this node")
    volume: float = Field(..., description="Volume delivered at this node")
    priority: Optional[int] = Field(None, description="Priority level of this order")
    arrival_time_min: Optional[int] = Field(None, description="Estimated arrival time (in minutes from midnight)")
    departure_time_min: Optional[int] = Field(None, description="Estimated departure time after service (in minutes from midnight)")
    cumulative_weight: float = Field(..., description="Total weight on the vehicle after visiting this node")
    cumulative_volume: float = Field(..., description="Total volume on the vehicle after visiting this node")

class VehicleRoute(BaseModel):
    vehicle_id: str = Field(..., description="ID of the vehicle assigned to this route")
    weight_capacity: float = Field(..., description="Total weight capacity of the vehicle")
    volume_capacity: float = Field(..., description="Total volume capacity of the vehicle")
    total_weight: float = Field(..., description="Total weight loaded onto this vehicle")
    total_volume: float = Field(..., description="Total volume loaded onto this vehicle")
    total_distance_meters: int = Field(..., description="Total distance traveled by this vehicle in meters")
    total_time_minutes: int = Field(..., description="Total route duration for this vehicle (in minutes)")
    total_cost: float = Field(..., description="Total calculated operational/travel cost for this route")
    route: List[RouteItem] = Field(..., description="Ordered list of stops (starting at depot, visiting orders, returning to depot)")

class OptimizeResponse(BaseModel):
    status: str = Field(..., description="Solving status (e.g. SUCCESS, NO_SOLUTION, FAILED)")
    total_distance_meters: int = Field(..., description="Total distance traveled by all vehicles in meters")
    total_weight: float = Field(..., description="Total weight delivered by all vehicles")
    total_volume: float = Field(..., description="Total volume delivered by all vehicles")
    total_cost: float = Field(..., description="Total operational cost of the fleet")
    routes: List[VehicleRoute] = Field(..., description="List of optimized routes for each active vehicle")
    unassigned_orders: List[str] = Field(..., description="List of order IDs that could not be assigned due to constraints")




