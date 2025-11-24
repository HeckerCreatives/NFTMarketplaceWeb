
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/utils/AxiosInstance";
import { handleApiError } from "@/utils/AxiosErrorHandler";

export interface ListItemData {
  inventoryId: string;
  tokenId: number;
  price: string;
  marketplaceAddress?: string;
  transactionHash?: string;
}

export const listInventory = async (data: ListItemData) => {
  const response = await axiosInstance.post("/inventory/list-item", data);
  return response.data;
};

export const useListInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: listInventory,
    onError: (error) => {
      handleApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventorylist"] });
      queryClient.invalidateQueries({ queryKey: ["inventorylistuser"] });
    },
  });
};
