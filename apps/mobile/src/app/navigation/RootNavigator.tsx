import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LoginScreen } from '../../screens/auth/LoginScreen';
import { HomeScreen } from '../../screens/dashboard/HomeScreen';
import { InboxScreen } from '../../screens/inbox/InboxScreen';
import { OrdersScreen } from '../../screens/orders/OrdersScreen';
import { MoreScreen } from '../../screens/more/MoreScreen';
import { useAuthStore } from '../../store/slices/auth-slice';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Inbox: undefined;
  Orders: undefined;
  More: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'WCO', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="Inbox" component={InboxScreen} />
      <Tabs.Screen name="Orders" component={OrdersScreen} />
      <Tabs.Screen name="More" component={MoreScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {accessToken ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
