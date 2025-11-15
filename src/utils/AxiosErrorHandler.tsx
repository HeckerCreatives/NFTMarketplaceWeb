import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";

export const handleApiError = (error: unknown) => {

    if (axios.isAxiosError(error) && error.response) {
        const { status, data: errorData } = error.response;

        if (status === 400) {
          toast.error(errorData?.data);
        } 

        if (status === 401) {
          toast.error(errorData?.data);
        } 

        if (status === 402) {
          toast.error(errorData?.data);
        } 
        if (status === 403) {
          toast.error(errorData?.data);
        } 
         if (status === 404) {
          toast.error(errorData?.data);
        } 
        if (status === 404) {
          toast.error(errorData?.data);
        } 

        if (status === 500) {
          toast.error(errorData?.data || "Internal server error");
        } 
    } 
};
