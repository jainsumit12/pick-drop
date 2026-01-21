import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from './slices/authSlice';
import routesReducer from './slices/routesSlice';
import filterReducer from './slices/filterSlice';
import dataReducer from './slices/dataSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  routes: routesReducer,
  filters: filterReducer,
  data: dataReducer,
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'routes', 'filters', 'data'], // persist auth, routes, filters, and data
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
