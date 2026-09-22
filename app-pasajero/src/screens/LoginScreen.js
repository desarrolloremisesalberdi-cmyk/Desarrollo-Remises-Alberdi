import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';

const API_URL = 'https://taxis-alberdi-backend.onrender.com'; 

export default function LoginScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ nombre, apellido: '', telefono }),
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
    <View style={styles.container}>
      <Text style={styles.title}>Radio Taxi Alberdi</Text>
      
      <TextInput 
        style={styles.input}
        placeholder="Nombre y Apellido"
        value={nombre}
        onChangeText={setNombre}
      />
      <TextInput 
        style={styles.input}
        placeholder="Teléfono"
        keyboardType="phone-pad"
        value={telefono}
        onChangeText={setTelefono}
      />
      
      <TouchableOpacity 
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Ingresar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 50,
    color: '#39ff14',
    textShadowColor: 'rgba(57, 255, 20, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  input: {
    height: 55,
    backgroundColor: '#111',
    borderColor: '#39ff14',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontSize: 16,
    color: '#fff'
  },
  button: {
    backgroundColor: '#39ff14',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#39ff14',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  }
});
