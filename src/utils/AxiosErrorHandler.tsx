import axios from "axios";
import toast from "react-hot-toast";

export const handleApiError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    toast.error("Network error. Please check your connection.");
    return;
  }

  const { status, data: errorData } = error.response;
  const message = (errorData && (errorData.message || errorData.data)) || 'An error occurred';

  switch (status) {
    case 400:
      toast.error(message);
      break;
    case 401:
      // Let AxiosInstance handle redirect/cleanup; show a concise message
      toast.error(message || 'Unauthorized. Please log in.');
      break;
    case 402:
      toast.error(message || 'Payment required');
      break;
    case 403:
      toast.error(message || 'Forbidden');
      break;
    case 404:
      toast.error(message || 'Not found');
      break;
    case 500:
      toast.error(message || 'Internal server error');
      break;
    default:
      toast.error(message);
      break;
  }
};
