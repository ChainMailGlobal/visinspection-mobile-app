import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "./screens/HomeScreen";
import LiveInspectionScreen from "./screens/LiveInspectionScreen";
import BuildingCodesScreen from "./screens/BuildingCodesScreen";
import ReportScreen from "./screens/ReportScreen";
import DiagnosticsScreen from "./screens/DiagnosticsScreen";
import ErrorBoundary from "./components/ErrorBoundary";

const Stack = createStackNavigator();

export default function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "VISION" }}
          />
          <Stack.Screen
            name="LiveInspection"
            component={LiveInspectionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BuildingCodes"
            component={BuildingCodesScreen}
            options={{ title: "Foresight" }}
          />
          <Stack.Screen
            name="Report"
            component={ReportScreen}
            options={{ title: "Report" }}
          />
          <Stack.Screen
            name="Diagnostics"
            component={DiagnosticsScreen}
            options={{ title: "Diagnostics" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
