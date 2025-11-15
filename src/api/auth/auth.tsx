
import { handleApiError } from "@/utils/AxiosErrorHandler";
import axiosInstance from "@/utils/AxiosInstance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const loginUser = async ( ipAddress: string, email: string, password: string
) => {
  const response = await axiosInstance.post(
    "/auth/login",{ipAddress, email, password}
  );
  
  return response.data;
};

export const useLogin = () => {

  return useMutation({
    mutationFn: ({ ipAddress, email, password }: {  ipAddress: string, email: string, password: string}) =>
    loginUser( ipAddress, email, password),
    onError: (error) => {
    },
  });
};

const logoutUser = async ( ) => {
  const response = await axiosInstance.post(
    "/auth/logout",
  );
  
  return response.data;
};

export const useLogout = () => {

  return useMutation({
    mutationFn: () =>
    logoutUser(),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Web3 Wallet Authentication Hooks

const requestNonce = async (walletAddress: string) => {
  const response = await axiosInstance.post(
    "/auth/wallet/request-nonce",
    { walletAddress }
  );
  return response.data;
};

export const useRequestNonce = () => {
  return useMutation({
    mutationFn: ({ walletAddress }: { walletAddress: string }) =>
      requestNonce(walletAddress),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const walletLogin = async (walletAddress: string, signature: string) => {
  const response = await axiosInstance.post(
    "/auth/wallet/login",
    { walletAddress, signature }
  );
  return response.data;
};

export const useWalletLogin = () => {
  return useMutation({
    mutationFn: ({ walletAddress, signature }: { walletAddress: string; signature: string }) =>
      walletLogin(walletAddress, signature),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const linkWallet = async (walletAddress: string, signature: string) => {
  const response = await axiosInstance.post(
    "/auth/wallet/link",
    { walletAddress, signature }
  );
  return response.data;
};

export const useLinkWallet = () => {
  return useMutation({
    mutationFn: ({ walletAddress, signature }: { walletAddress: string; signature: string }) =>
      linkWallet(walletAddress, signature),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const unlinkWallet = async () => {
  const response = await axiosInstance.post("/auth/wallet/unlink");
  return response.data;
};

export const useUnlinkWallet = () => {
  return useMutation({
    mutationFn: () => unlinkWallet(),
    onError: (error) => {
      handleApiError(error);
    },
  });
};



