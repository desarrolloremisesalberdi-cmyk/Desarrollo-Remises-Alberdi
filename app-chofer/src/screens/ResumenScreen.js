import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';

export default function ResumenScreen({ route, navigation }) {
  const chofer = route?.params?.chofer || { id: null };
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    if (chofer.id) {
      fetch(`${API_URL}/api/finanzas/chofer/${chofer.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setViajes(data.viajes);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [chofer.id]);

  const totalRecaudado = viajes.reduce((acc, v) => acc + Number(v.monto_calculado || 0), 0);
  const totalComision = viajes.reduce((acc, v) => acc + Number(v.comision_admin || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: theme.accent, fontSize: 16, fontWeight: 'bold' }}>{'< Volver'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mis Ganancias</Text>
        <View style={{width: 60}} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Resumen Total</Text>
            <View style={styles.row}>
              <Text style={{ color: theme.text, fontSize: 16 }}>Viajes Completados:</Text>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>{viajes.length}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: theme.text, fontSize: 16 }}>Recaudación Total:</Text>
              <Text style={{ color: '#10b981', fontSize: 18, fontWeight: 'bold' }}>${totalRecaudado.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: theme.text, fontSize: 16 }}>Comisión Agencia (15%):</Text>
              <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>${totalComision.toFixed(2)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.row}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Ganancia Neta:</Text>
              <Text style={{ color: theme.accent, fontSize: 22, fontWeight: 'bold' }}>${(totalRecaudado - totalComision).toFixed(2)}</Text>
            </View>
          </View>

          <Text style={[styles.listTitle, { color: theme.text }]}>Historial de Viajes</Text>
          
          {viajes.length === 0 ? (
            <Text style={{ color: theme.placeholder, textAlign: 'center', marginTop: 20 }}>No tienes viajes registrados aún.</Text>
          ) : (
            viajes.map(viaje => (
              <View key={viaje.id} style={[styles.tripCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.row}>
                  <Text style={{ color: theme.text, fontWeight: 'bold' }}>#{viaje.id.substring(0,6)}...</Text>
                  <Text style={{ color: theme.placeholder }}>{new Date(viaje.fecha).toLocaleString()}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={{ color: theme.text }}>Pasajero:</Text>
                  <Text style={{ color: theme.text }}>{viaje.pasajero_nombre} {viaje.pasajero_apellido}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={{ color: theme.text }}>Distancia:</Text>
                  <Text style={{ color: theme.text }}>{Number(viaje.distancia_km || 0).toFixed(2)} km</Text>
                </View>
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Text style={{ color: theme.text, fontWeight: 'bold' }}>Cobrado:</Text>
                  <Text style={{ color: '#10b981', fontWeight: 'bold' }}>${Number(viaje.monto_calculado || 0).toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const darkTheme = {
  bg: '#0f172a',
  cardBg: 'rgba(30, 41, 59, 0.95)',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#f59e0b', // Ámbar (Chofer)
};

const lightTheme = {
  bg: '#f1f5f9',
  cardBg: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(0, 0, 0, 0.1)',
  text: '#0f172a',
  placeholder: '#64748b',
  accent: '#f59e0b',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50, // Notch
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 30,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  tripCard: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
  }
});
