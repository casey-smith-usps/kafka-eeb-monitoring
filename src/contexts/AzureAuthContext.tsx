import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AuthenticationResult,
  AccountInfo,
  InteractionRequiredAuthError
} from '@azure/msal-browser';
import { msalInstance, loginRequest, tokenRequest, getRoleFromToken } from '../config/azureAdConfig';

interface AzureAuthContextType {
  user: AccountInfo | null;
  role: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AzureAuthContext = createContext<AzureAuthContextType | undefined>(undefined);

export const AzureAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeMsal();
  }, []);

  const initializeMsal = async () => {
    try {
      await msalInstance.initialize();

      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
        setUser(accounts[0]);

        const token = await getAccessToken();
        if (token) {
          const userRole = getRoleFromToken(token);
          setRole(userRole);
        }
      }
    } catch (error) {
      console.error('MSAL initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      const response: AuthenticationResult = await msalInstance.loginPopup(loginRequest);

      msalInstance.setActiveAccount(response.account);
      setUser(response.account);
      setAccessToken(response.accessToken);

      const userRole = getRoleFromToken(response.accessToken);
      setRole(userRole);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await msalInstance.logoutPopup({
        account: user,
      });
      setUser(null);
      setRole(null);
      setAccessToken(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      return null;
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...tokenRequest,
        account,
      });

      setAccessToken(response.accessToken);
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          const response = await msalInstance.acquireTokenPopup(tokenRequest);
          setAccessToken(response.accessToken);
          return response.accessToken;
        } catch (popupError) {
          console.error('Token acquisition popup error:', popupError);
          return null;
        }
      }
      console.error('Token acquisition error:', error);
      return null;
    }
  };

  return (
    <AzureAuthContext.Provider
      value={{
        user,
        role,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AzureAuthContext.Provider>
  );
};

export const useAzureAuth = () => {
  const context = useContext(AzureAuthContext);
  if (!context) {
    throw new Error('useAzureAuth must be used within AzureAuthProvider');
  }
  return context;
};
