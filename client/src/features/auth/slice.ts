import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  ChangePasswordRequest,
  LoginRequest,
  SessionAccountDto,
} from "@unah-red-tutores/shared";

import authApi from "./api";
import { normalizeApiError, type NormalizedApiError } from "../../utils/api";

export interface AuthState {
  account: SessionAccountDto | null;
  loading: boolean;
  error: NormalizedApiError | null;
}

const initialState: AuthState = {
  account: null,
  loading: false,
  error: null,
};

function rejection(error: unknown): NormalizedApiError {
  return normalizeApiError(error);
}

export const login = createAsyncThunk<
  SessionAccountDto,
  LoginRequest,
  { rejectValue: NormalizedApiError }
>("auth/login", async (body, { rejectWithValue }) => {
  try {
    const response = await authApi.login(body);
    return response.data;
  } catch (error) {
    return rejectWithValue(rejection(error));
  }
});

export const fetchMe = createAsyncThunk<
  SessionAccountDto,
  void,
  { rejectValue: NormalizedApiError }
>("auth/me", async (_, { rejectWithValue }) => {
  try {
    const response = await authApi.me();
    return response.data;
  } catch (error) {
    return rejectWithValue(rejection(error));
  }
});

export const logout = createAsyncThunk<
  void,
  void,
  { rejectValue: NormalizedApiError }
>("auth/logout", async (_, { rejectWithValue }) => {
  try {
    await authApi.logout();
  } catch (error) {
    return rejectWithValue(rejection(error));
  }
});

export const changePassword = createAsyncThunk<
  SessionAccountDto,
  ChangePasswordRequest,
  { rejectValue: NormalizedApiError }
>("auth/changePassword", async (body, { rejectWithValue }) => {
  try {
    const response = await authApi.changePassword(body);
    return response.data;
  } catch (error) {
    return rejectWithValue(rejection(error));
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccount(state, action: PayloadAction<SessionAccountDto | null>) {
      state.account = action.payload;
      state.error = null;
    },
    clearAccount(state) {
      state.account = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.account = action.payload;
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? null;
      })
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.account = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.account = null;
        state.error = null;
        state.loading = false;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.account = action.payload;
      });
  },
});

export const { setAccount, clearAccount } = authSlice.actions;
export default authSlice;
