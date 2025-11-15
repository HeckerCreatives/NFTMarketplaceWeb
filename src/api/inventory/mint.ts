
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/utils/AxiosInstance";
import { handleApiError } from "@/utils/AxiosErrorHandler";
import { MintItemData } from "@/types/inventory";




export const mintInventory = async (data: MintItemData) => {
  const response = await axiosInstance.post("/inventory/mint-item", data)
  return response.data
}

export const useMintInventory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mintInventory,
    onError: (error) => {
      handleApiError(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventorylist"]})
      queryClient.invalidateQueries({ queryKey: ["inventorylistuser"]})
    }
  })
}





