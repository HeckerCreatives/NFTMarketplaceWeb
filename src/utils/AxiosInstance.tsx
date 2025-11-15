import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";

let isRedirecting = false;
let isShowingToast = false;

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

const showToastOnce = (message: string) => {
  if (isShowingToast) return;
  isShowingToast = true;
  toast.error(message);
  setTimeout(() => {
    isShowingToast = false;
  }, 3000); 
};

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; data?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;


      switch (status) {
        case 401:
          if (!isRedirecting) {
            isRedirecting = true;

            showToastOnce(data?.message || "Session expired. Please log in again.");
            localStorage.removeItem("auth");

            if (typeof window !== "undefined") {
              setTimeout(() => {
                window.location.href = "/";
              }, 5000);
            }

            setTimeout(() => {
              isRedirecting = false;
            }, 5000);
          }
          break;

        case 400:
           showToastOnce(`${data?.message}, ${data.data}` || "Something went wrong.");
          break;
        case 403:
           showToastOnce(`${data?.message}, ${data.data}` || "Something went wrong.");
          break;
        case 404:
           showToastOnce(`${data?.message}, ${data.data}` || "Something went wrong.");
          break;
        case 500:
          
          showToastOnce(`${data?.message}, ${data.data}` || "Something went wrong.");
          break;

        default:
          showToastOnce(`${data?.message}, ${data.data}` || "An unknown error occurred.");
          break;
      }
    } else {
      showToastOnce("Network error. Please check your connection.");
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
