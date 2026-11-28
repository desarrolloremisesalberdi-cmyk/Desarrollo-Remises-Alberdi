import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleSendCode = async () => {
    if (!email || !email.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa tu correo electrónico.');
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${API_URL}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success) {
        if (data.token) {
          Alert.alert(
            'Código Generado',
            `Tu código de recuperación es:\n\n${data.token}\n\nIngrésalo a continuación para crear tu nueva contraseña.`,
            [
              {
                text: 'Continuar',
                onPress: () => navigation.navigate('ResetPassword', { email: email.trim(), token: data.token })
              }
            ]
          );
        } else {
          Alert.alert(
            'Código Enviado',
            'Se ha enviado un código a tu correo electrónico. Por favor revisa tu bandeja de entrada o spam.',
            [
              {
                text: 'Continuar',
                onPress: () => navigation.navigate('ResetPassword', { email: email.trim() })
              }
            ]
          );
        }
      } else {
        Alert.alert('Atención', data.error || 'Error al solicitar el código.');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      Alert.alert('Error de conexión', 'No pudimos comunicarnos con el servidor. Por favor verifica tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Recuperar Cuenta</Text>
      <Text style={[styles.subtitle, { color: theme.placeholder }]}>
        Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un código para restablecer tu contraseña.
      </Text>

      <TextInput 
        style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Correo Electrónico"
        placeholderTextColor={theme.placeholder}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.accent }]}
        onPress={handleSendCode}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar Código</Text>}
      </TouchableOpacity>
    </View>
  );
}

const darkTheme = { bg: '#0f172a', cardBg: 'rgba(30, 41, 59, 0.7)', border: 'rgba(255, 255, 255, 0.1)', text: '#f8fafc', placeholder: '#94a3b8', accent: '#10b981' };
const lightTheme = { bg: '#f1f5f9', cardBg: 'rgba(255, 255, 255, 0.8)', border: 'rgba(0, 0, 0, 0.1)', text: '#0f172a', placeholder: '#64748b', accent: '#10b981' };

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  input: { height: 55, borderWidth: 1, borderRadius: 12, paddingHorizontal: 20, marginBottom: 20, fontSize: 16 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
