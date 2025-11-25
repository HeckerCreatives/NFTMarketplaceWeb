
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/utils/AxiosInstance";
import { handleApiError } from "@/utils/AxiosErrorHandler";

export interface TransferItemData {
  inventoryId: string;
  recipientWallet: string;
  txHash?: string;
}

export const transferInventory = async (data: TransferItemData) => {
  const response = await axiosInstance.post("/inventory/transfer-item", data);
  return response.data;
}

export const useTransferInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transferInventory,
    onError: (error) => {
      handleApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventorylist"] });
      queryClient.invalidateQueries({ queryKey: ["inventorylistuser"] });
    }
  });
}

// /inventory/transfer-item
// body: { inventoryId, recipientWallet, txHash }