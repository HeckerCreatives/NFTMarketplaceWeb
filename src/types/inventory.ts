

export interface InventoryItem {
    _id: string;
    owner: string;
    item: any;
    itemid: string;
    itemname: string;
    type: string;
    quantity: number;
    isEquipped: boolean;
    ipfsImage?: string;
    isMintable?: boolean;
    isMinted?: boolean;
    isListed?: boolean;
    isTransferable?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface InventorySummary {
    byType?: Record<string, { count: number; totalQuantity: number }>;
    totalQuantity?: number;
}

export interface MyInventoryResponse {
    message: string;
    data: {
        inventory: InventoryItem[];
        totalItems?: number;
        summary?: InventorySummary;
    };
}

export interface MintItemData {
    inventoryId: string;
    quantity?: number;
    metadataUri?: string;
    targetWallet?: string;
}