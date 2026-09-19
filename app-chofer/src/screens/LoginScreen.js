import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';

const API_URL = 'http://localhost:3000';

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
    backgroundColor: '#f8f9fa',
    flexGrow: 1,
    justifyContent: 'center'
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 40,
    color: '#111827',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 20,
    color: '#374151',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    backgroundColor: '#10b981',
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
