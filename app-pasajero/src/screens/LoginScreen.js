import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, useColorScheme, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com'; 

export default function LoginScreen({ navigation }) {
  const [identificador, setIdentificador] = useState('');
  const [clave, setClave] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedId = await AsyncStorage.getItem('pasajero_id');
        const savedClave = await AsyncStorage.getItem('pasajero_clave');
        if (savedId && savedClave) {
          setIdentificador(savedId);
          setClave(savedClave);
          setRecordar(true);
        }
      } catch (e) {
        // Ignorar error
      }
    };
    loadCredentials();

    if (Platform.OS === 'web') {
      const savedUser = localStorage.getItem('pasajero_user');
      if (savedUser) {
        navigation.replace('Map', { user: JSON.parse(savedUser) });
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!identificador || !clave) {
      alert('Por favor ingresá tu DNI/Email y contraseña');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni_o_email: identificador, clave }),
      });

      const data = await response.json();
      
      if (data.success) {
        if (recordar) {
          await AsyncStorage.setItem('pasajero_id', identificador);
          await AsyncStorage.setItem('pasajero_clave', clave);
        } else {
          await AsyncStorage.removeItem('pasajero_id');
          await AsyncStorage.removeItem('pasajero_clave');
        }

        if (Platform.OS === 'web') {
          localStorage.setItem('pasajero_user', JSON.stringify(data.user));
        }
        navigation.replace('Map', { user: data.user });
      } else {
        alert(data.error || 'No se pudo iniciar sesión');
      }
    } catch (error) {
      alert('Hubo un problema de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Taxis Alberdi</Text>
      
      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
        placeholder="DNI o Correo Electrónico"
        placeholderTextColor={theme.placeholder}
        value={identificador}
        onChangeText={setIdentificador}
        autoCapitalize="none"
      />
      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Contraseña"
        placeholderTextColor={theme.placeholder}
        secureTextEntry
        value={clave}
        onChangeText={setClave}
      />
      
      <View style={styles.switchContainer}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>Recordar usuario</Text>
        <Switch
          value={recordar}
          onValueChange={setRecordar}
          trackColor={{ false: '#767577', true: theme.accent }}
          thumbColor={recordar ? '#fff' : '#f4f3f4'}
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

      <View style={styles.linksContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={[styles.linkText, { color: theme.accent }]}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 15 }}>
          <Text style={[styles.linkText, { color: theme.text }]}>
            ¿No tienes cuenta? <Text style={{ color: theme.accent, fontWeight: '700' }}>Regístrate aquí</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const darkTheme = {
  bg: '#0f172a',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#10b981', 
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
  linksContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
  }
});
