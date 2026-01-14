import axiosInstance from '../axios';

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  user: {
    username: string;
    role: string;
    token?: string;
  };
  token?: string;
}

interface RegisterData {
  username: string;
  password: string;
  email: string;
  role?: string;
}

export const authService = {
  // Login user
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  // Register new user
  register: async (data: RegisterData): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/register', data);
    return response.data;
  },

  // Logout user
  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },

  // Refresh token
  refreshToken: async (): Promise<{ token: string }> => {
    const response = await axiosInstance.post<{ token: string }>('/auth/refresh');
    return response.data;
  },

  // Verify token
  verifyToken: async (): Promise<{ valid: boolean }> => {
    const response = await axiosInstance.get<{ valid: boolean }>('/auth/verify');
    return response.data;
  },

  // Get current user profile
  getCurrentUser: async (): Promise<LoginResponse['user']> => {
    const response = await axiosInstance.get<LoginResponse['user']>('/auth/me');
    return response.data;
  },
};
