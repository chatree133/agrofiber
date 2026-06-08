function calculateMargin(unitPrice, unitCost) {
    if (unitPrice === 0) return 0;
    return ((unitPrice - unitCost) / unitPrice) * 100;
}

function calculateMarkup(unitPrice, unitCost) {
    if (unitCost === 0) return 0;
    return ((unitPrice - unitCost) / unitCost) * 100;
}

export { calculateMargin, calculateMarkup };

export function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

export function calculateProposedPrice({ pricingMethodCode, standardPrice, standardCost, targetMarginPercent, targetMarkupPercent }) {
    const sPrice = Number(standardPrice || 0);
    const sCost = Number(standardCost || 0);
    const markup = Number(targetMarkupPercent || 0);
    const margin = Number(targetMarginPercent || 0);

    let proposedPrice = sPrice;
    switch (pricingMethodCode) {
        case 'FIXED_PRICE':
            proposedPrice = sPrice;
            break;
        case 'MARKUP':
            proposedPrice = sCost + (sCost * (markup / 100));
            break;
        case 'MARGIN':
            if (margin < 100) {
                proposedPrice = sCost / (1 - margin / 100);
            } else {
                proposedPrice = 0;
            }
            break;
    }
    return proposedPrice;
}

export function validatePricingPolicy(r) {
    const standardPrice = Number(r.StandardPrice ?? r.standardPrice ?? 0);
    const standardCost = Number(r.StandardCost ?? r.standardCost ?? 0);
    const markup = Number(r.TargetMarkupPercent ?? r.targetMarkupPercent ?? 0);
    const margin = Number(r.TargetMarginPercent ?? r.targetMarginPercent ?? 0);
    const minMargin = Number(r.MinMarginPercent ?? r.minMarginPercent ?? 0);

    const proposedPrice = calculateProposedPrice({
        pricingMethodCode: r.PricingMethodCode ?? r.pricingMethodCode,
        standardPrice,
        standardCost,
        targetMarginPercent: margin,
        targetMarkupPercent: markup,
    });

    const proposedMargin = calculateMargin(proposedPrice, standardCost);

    const isBelowCost = proposedPrice < standardCost;
    const isBelowMinMargin = proposedMargin < minMargin;
    const isBelowRecommended = standardPrice > 0 && standardPrice < proposedPrice;
    const isBelowPrice = isBelowCost || isBelowRecommended;
    const hasWarning = isBelowCost || isBelowMinMargin || isBelowRecommended;

    let warningStatus = 'ok';
    let warningLabel = '';
    let warningTooltip = '';

    if (isBelowCost) {
        warningStatus = 'below_cost';
        warningLabel = 'ต่ำกว่าราคาทุน';
        warningTooltip = 'ราคานำเสนอต่ำกว่าราคาทุนมาตรฐาน';
    } else if (isBelowMinMargin) {
        warningStatus = 'below_min_margin';
        warningLabel = 'ต่ำกว่าอัตรากำไร';
        warningTooltip = 'อัตรากำไรของราคาเสนอ ต่ำกว่าเปอร์เซ็นต์กำไรขั้นต่ำของสินค้า';
    } else if (isBelowRecommended) {
        warningStatus = 'below_recommended';
        warningLabel = 'ต่ำกว่าราคาควรขาย';
        warningTooltip = 'ราคาเสนอขาย ต่ำกว่าราคาที่คำนวณตามเกณฑ์ขั้นต่ำ (ราคาควรขาย)';
    }

    return {
        proposedPrice,
        proposedMargin,
        isBelowCost,
        isBelowMinMargin,
        isBelowRecommended,
        isBelowPrice,
        hasWarning,
        warningStatus,
        warningLabel,
        warningTooltip,
    };
}