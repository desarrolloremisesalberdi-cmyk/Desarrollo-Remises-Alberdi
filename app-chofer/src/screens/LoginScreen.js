import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';

export default function LoginScreen({ navigation }) {
  const [dni, setDni] = useState('');
  const [clave, setClave] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const savedChofer = localStorage.getItem('chofer_user');
      if (savedChofer) {
        navigation.replace('Main', { chofer: JSON.parse(savedChofer) });
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!dni || !clave) {
      alert('Por favor ingresá tu DNI y Clave');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/choferes/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, clave })
      });
      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          localStorage.setItem('chofer_user', JSON.stringify(data.chofer));
        }
        navigation.replace('Main', { chofer: data.chofer });
      } else {
        alert(data.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      alert('Error al conectar con el servidor');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Panel de Chofer</Text>
      
      <Text style={styles.subtitle}>Iniciar Sesión</Text>
      <TextInput 
        style={styles.input} 
        placeholder="DNI" 
        keyboardType="numeric" 
        value={dni}
        onChangeText={setDni}
      />
      <TextInput 
        style={styles.input} 
        placeholder="Clave (Asignada por Operador)" 
        secureTextEntry={true} 
        value={clave}
        onChangeText={setClave}
      />
      
      <TouchableOpacity 
        style={styles.button}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Entrar a Trabajar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 30,
    backgroundColor: '#050505',
    flexGrow: 1,
    justifyContent: 'center'
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
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 20,
    color: '#fff',
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
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 25,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  }
});
