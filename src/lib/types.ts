export type VideoDescription = {
    disclaimer?: string //markdown
    timestamps?: {
        time_interval: string
        time_content: string
    }[]
    description?: string // markdown
}


export interface GooglePlayReceipt {
    startTime: string;
    subscriptionState: string;
    orderId: string;
    linkedPurchaseToken?: string | null;
    acknowledgementState: string;
    subscribeWithGoogleInfo?: {
        profileId: string;
        profileName: string;
        emailAddress: string;
        givenName: string;
        familyName: string;
    };
    lineItems: Array<{
        productId: string;
        expiryTime: string;
        autoRenewingPlan: {
            autoRenewEnabled: boolean;
            recurringPrice: {
                units: string;
                nanos: number;
                currencyCode: string;
            };
            priceChangeDetails: any | null;
            priceStepUpConsentDetails: any | null;
            installmentDetails: any | null;
        } | null;
        prepaidPlan: any | null;
        offerDetails: {
            basePlanId: string;
            offerId: string;
            offerTags: string[];
        };
        deferredItemReplacement: any | null;
        signupPromotion: any | null;
    }>;
}