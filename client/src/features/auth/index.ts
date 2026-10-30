import slice, {
  changePassword,
  clearAccount,
  fetchMe,
  login,
  logout,
  setAccount,
} from "./slice";
import authApi from "./api";

export * from "./api";
export type { AuthState } from "./slice";
export type { LoginRequest, SessionAccountDto } from "@unah-red-tutores/shared";

export default {
  slice,
  api: authApi,
  actions: {
    login,
    logout,
    fetchMe,
    changePassword,
    setAccount,
    clearAccount,
  },
};
