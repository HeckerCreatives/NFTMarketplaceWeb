
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/utils/AxiosInstance";
import { handleApiError } from "@/utils/AxiosErrorHandler";
import { UserItemResponse } from "@/types/user";

export const getUsers = async (page: number, limit: number, search: string): Promise<UserItemResponse> => { 
  const response = await axiosInstance.get(
    `/auth/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
  )
  return response.data;
};

export const useGetUsers = (page: number, limit: number, search: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["users", page, limit, search],
    queryFn: () => getUsers(page, limit, search),
    retry: false,
    enabled,
  });
};