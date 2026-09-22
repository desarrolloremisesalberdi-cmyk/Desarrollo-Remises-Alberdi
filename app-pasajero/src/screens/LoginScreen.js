import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, useColorScheme, Switch } from 'react-native';

const API_URL = 'https://taxis-alberdi-backend.onrender.com'; 

export default function LoginScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [esJubilado, setEsJubilado] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const savedUser = localStorage.getItem('pasajero_user');
      if (savedUser) {
        navigation.replace('Map', { user: JSON.parse(savedUser) });
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!nombre || !telefono) {
      alert('Por favor ingresá tu nombre y teléfono');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido: '', telefono, es_jubilado: esJubilado }),
      });

      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          localStorage.setItem('pasajero_user', JSON.stringify(data.user));
        }
        navigation.replace('Map', { user: data.user });
      } else {
        alert('No se pudo iniciar sesión');
      }
    } catch (error) {
      alert('Hubo un problema de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Remises Alberdi</Text>
      
      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Nombre y Apellido"
        placeholderTextColor={theme.placeholder}
        value={nombre}
        onChangeText={setNombre}
      />
      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Teléfono"
        placeholderTextColor={theme.placeholder}
        keyboardType="phone-pad"
        value={telefono}
        onChangeText={setTelefono}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>¿Sos Jubilado / Pensionado?</Text>
        <Switch
          value={esJubilado}
          onValueChange={setEsJubilado}
          trackColor={{ false: '#767577', true: theme.accent }}
          thumbColor={esJubilado ? '#fff' : '#f4f3f4'}
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.accent }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Ingresar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const darkTheme = {
  bg: '#0f172a',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#10b981', // Verde Esmeralda (Cliente)
};

const lightTheme = {
  bg: '#f1f5f9',
  cardBg: 'rgba(255, 255, 255, 0.8)',
  border: 'rgba(0, 0, 0, 0.1)',
  text: '#0f172a',
  placeholder: '#64748b',
  accent: '#10b981',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 50,
    letterSpacing: -1,
  },
  input: {
    height: 55,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
  }
});
