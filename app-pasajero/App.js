import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.log('ErrorBoundary error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0b1320', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
            Aviso de Inicialización
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
            {String(this.state.error?.message || this.state.error || 'Ocurrió un error inesperado')}
          </Text>
          <TouchableOpacity 
            onPress={() => this.setState({ hasError: false, error: null })} 
            style={{ backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
