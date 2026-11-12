import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, useColorScheme, Switch, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function LoginScreen({ navigation }) {
  const [dni, setDni] = useState('');
  const [clave, setClave] = useState('');
  const [recordar, setRecordar] = useState(false);

  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedDni = await AsyncStorage.getItem('chofer_dni');
        const savedClave = await AsyncStorage.getItem('chofer_clave');
        if (savedDni && savedClave) {
          setDni(savedDni);
          setClave(savedClave);
          setRecordar(true);
        }
      } catch (e) {
        // Ignorar
      }
    };
    loadCredentials();

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
        if (recordar) {
          await AsyncStorage.setItem('chofer_dni', dni);
          await AsyncStorage.setItem('chofer_clave', clave);
        } else {
          await AsyncStorage.removeItem('chofer_dni');
          await AsyncStorage.removeItem('chofer_clave');
        }

        if (Platform.OS === 'web') {
          localStorage.setItem('chofer_user', JSON.stringify(data.chofer));
        }
        navigation.replace('Main', { chofer: data.chofer });
      } else {
        if (data.error === 'suspended') {
          alert('Usuario bloqueado. Comuniquese con el operador.');
        } else {
          alert(data.error || 'Error al iniciar sesión');
        }
      }
    } catch (error) {
      alert('Error al conectar con el servidor');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Image 
          source={require('../../assets/logo-alberdi.png')} 
          style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 14, borderWidth: 2, borderColor: '#10b981' }} 
          resizeMode="cover"
        />
        <Text style={[styles.title, { color: theme.text, marginBottom: 4 }]}>Taxis Alberdi</Text>
        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', borderWidth: 1, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 }}>
          <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 12, letterSpacing: 0.8 }}>
            PORTAL DEL CHOFER
          </Text>
        </View>
      </View>
      
      <View style={{ backgroundColor: theme.cardBg, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: theme.border }}>
        <Text style={[styles.subtitle, { color: theme.text }]}>Iniciar Turno</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderColor: theme.border, color: theme.text }]} 
          placeholder="DNI" 
          placeholderTextColor={theme.placeholder}
          keyboardType="numeric" 
          value={dni}
          onChangeText={setDni}
        />
        <TextInput 
          style={[styles.input, { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderColor: theme.border, color: theme.text }]} 
          placeholder="Clave (Asignada por Operador)" 
          placeholderTextColor={theme.placeholder}
          secureTextEntry={true} 
          value={clave}
          onChangeText={setClave}
        />
        
        <View style={styles.switchContainer}>
          <Text style={[styles.switchLabel, { color: theme.text }]}>Recordar mis datos</Text>
          <Switch
            value={recordar}
            onValueChange={setRecordar}
            trackColor={{ false: '#334155', true: '#10b981' }}
            thumbColor={recordar ? '#fff' : '#94a3b8'}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#10b981' }]}
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>⚡ Entrar a Trabajar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const darkTheme = {
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  placeholder: '#64748b',
  accent: '#10b981', // Verde Esmeralda Neón Oficial
};

const lightTheme = {
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  placeholder: '#64748b',
  accent: '#10b981',
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    fontSize: 15,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingHorizontal: 2,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  }
});
