import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, useColorScheme } from 'react-native';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';

export default function LoginScreen({ navigation }) {
  const [dni, setDni] = useState('');
  const [clave, setClave] = useState('');

  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Portal Chofer</Text>
      
      <Text style={[styles.subtitle, { color: theme.text }]}>Iniciar Sesión</Text>
      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} 
        placeholder="DNI" 
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric" 
        value={dni}
        onChangeText={setDni}
      />
      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} 
        placeholder="Clave (Asignada por Operador)" 
        placeholderTextColor={theme.placeholder}
        secureTextEntry={true} 
        value={clave}
        onChangeText={setClave}
      />
      
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.accent }]}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Entrar a Trabajar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const darkTheme = {
  bg: '#0f172a',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#f59e0b', // Ámbar (Chofer)
};

const lightTheme = {
  bg: '#f1f5f9',
  cardBg: 'rgba(255, 255, 255, 0.8)',
  border: 'rgba(0, 0, 0, 0.1)',
  text: '#0f172a',
  placeholder: '#64748b',
  accent: '#f59e0b',
};

const styles = StyleSheet.create({
  container: {
    padding: 30,
    flexGrow: 1,
    justifyContent: 'center'
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 50,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 20,
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
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 25,
    shadowColor: '#f59e0b',
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
