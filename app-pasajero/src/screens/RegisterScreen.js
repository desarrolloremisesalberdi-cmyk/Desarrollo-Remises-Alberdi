import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, useColorScheme, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '', clave: '', repetirClave: ''
  });
  const [fotoBase64, setFotoBase64] = useState(null);
  const [fotoUri, setFotoUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("Necesitamos permisos para acceder a tus fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true
    });

    if (!result.canceled) {
      setFotoUri(result.assets[0].uri);
      setFotoBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleRegister = async () => {
    if (!form.nombre || !form.apellido || !form.dni || !form.telefono || !form.email || !form.clave) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    if (form.clave !== form.repetirClave) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    if (!fotoBase64) {
      alert('Es obligatorio subir una foto de tu DNI.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          dni: form.dni,
          telefono: form.telefono,
          email: form.email,
          clave: form.clave,
          foto_base64: fotoBase64
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
        navigation.goBack();
      } else {
        alert(data.error || 'Error al registrar.');
      }
    } catch (error) {
      alert('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ padding: 30, paddingBottom: 60 }}>
      <Text style={[styles.title, { color: theme.text }]}>Crear Cuenta</Text>
      
      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="Nombre" placeholderTextColor={theme.placeholder} value={form.nombre} onChangeText={t => setForm({...form, nombre: t})} />
      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="Apellido" placeholderTextColor={theme.placeholder} value={form.apellido} onChangeText={t => setForm({...form, apellido: t})} />
      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="DNI" placeholderTextColor={theme.placeholder} keyboardType="numeric" value={form.dni} onChangeText={t => setForm({...form, dni: t})} />
      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="Teléfono" placeholderTextColor={theme.placeholder} keyboardType="phone-pad" value={form.telefono} onChangeText={t => setForm({...form, telefono: t})} />
      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="Correo Electrónico" placeholderTextColor={theme.placeholder} keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={t => setForm({...form, email: t})} />
      
      <View style={styles.imagePickerContainer}>
        <Text style={{ color: theme.text, marginBottom: 10, fontSize: 16 }}>Foto del Frente del DNI</Text>
        <TouchableOpacity style={[styles.imageButton, { borderColor: theme.accent }]} onPress={handlePickImage}>
          {fotoUri ? (
            <Image source={{ uri: fotoUri }} style={styles.imagePreview} />
          ) : (
            <Text style={{ color: theme.accent, fontWeight: 'bold' }}>+ Adjuntar Foto</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="Contraseña" placeholderTextColor={theme.placeholder} secureTextEntry value={form.clave} onChangeText={t => setForm({...form, clave: t})} />
      <TextInput style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]} placeholder="Repetir Contraseña" placeholderTextColor={theme.placeholder} secureTextEntry value={form.repetirClave} onChangeText={t => setForm({...form, repetirClave: t})} />

      <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrarme</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const darkTheme = { bg: '#0f172a', cardBg: 'rgba(30, 41, 59, 0.7)', border: 'rgba(255, 255, 255, 0.1)', text: '#f8fafc', placeholder: '#94a3b8', accent: '#10b981' };
const lightTheme = { bg: '#f1f5f9', cardBg: 'rgba(255, 255, 255, 0.8)', border: 'rgba(0, 0, 0, 0.1)', text: '#0f172a', placeholder: '#64748b', accent: '#10b981' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 30, marginTop: 20 },
  input: { height: 55, borderWidth: 1, borderRadius: 12, paddingHorizontal: 20, marginBottom: 15, fontSize: 16 },
  imagePickerContainer: { marginBottom: 20, alignItems: 'center' },
  imageButton: { width: '100%', height: 120, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.02)' },
  imagePreview: { width: '100%', height: '100%', borderRadius: 10, resizeMode: 'cover' },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
