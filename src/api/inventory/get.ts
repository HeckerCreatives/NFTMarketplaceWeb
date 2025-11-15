import { MyInventoryResponse } from "@/types/inventory";
import axiosInstance from "@/utils/AxiosInstance";
import { useDebounce } from "@/utils/debounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const getMyInventory = async (): Promise<MyInventoryResponse> => { 
  const response = await axiosInstance.get(
    "/inventory/my-items"
  )
  return response.data
  
};


export const useGetMyInventory = () => {
  return useQuery({
    queryKey: ["myinventory"],
    queryFn: () => getMyInventory(),
    retry: false,

    
  });
};




