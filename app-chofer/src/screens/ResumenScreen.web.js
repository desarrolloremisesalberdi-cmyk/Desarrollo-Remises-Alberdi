import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function ResumenScreen({ route, navigation }) {
  const chofer = route?.params?.chofer || { id: null };
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const isDarkMode = true; // Siempre oscuro
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
      <View style={[styles.header, { backgroundColor: '#0b1320', borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{
            paddingVertical: 7,
            paddingHorizontal: 12,
            backgroundColor: 'rgba(30, 41, 59, 0.85)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer'
          }}
        >
          <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: '700' }}>⬅ Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#f8fafc' }]}>📊 Mis Ganancias</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={[styles.summaryCard, { 
            backgroundColor: 'rgba(15, 23, 42, 0.94)', 
            borderColor: 'rgba(16, 185, 129, 0.4)',
            borderWidth: 1.5,
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Resumen del Chofer</Text>
            <View style={styles.row}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Viajes Completados:</Text>
              <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: 'bold' }}>{viajes.length}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Recaudación Total:</Text>
              <Text style={{ color: '#10b981', fontSize: 18, fontWeight: 'bold' }}>${totalRecaudado.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Comisión Agencia:</Text>
              <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>${totalComision.toFixed(2)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]} />
            <View style={styles.row}>
              <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: 'bold' }}>Ganancia Neta:</Text>
              <Text style={{ color: '#10b981', fontSize: 24, fontWeight: '900' }}>${(totalRecaudado - totalComision).toFixed(2)}</Text>
            </View>
          </View>

          <Text style={[styles.listTitle, { color: '#f8fafc' }]}>Historial de Viajes</Text>
          
          {viajes.length === 0 ? (
            <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 20 }}>No tienes viajes registrados aún.</Text>
          ) : (
            viajes.map(viaje => (
              <View key={viaje.id} style={[styles.tripCard, { 
                backgroundColor: 'rgba(15, 23, 42, 0.94)', 
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }]}>
                <View style={styles.row}>
                  <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>#{String(viaje.id)}</Text>
                  <Text style={{ color: '#64748b', fontSize: 12 }}>
                    {viaje.fecha ? new Date(viaje.fecha).toLocaleString() : (viaje.created_at ? new Date(viaje.created_at).toLocaleString() : 'Reciente')}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={{ color: '#94a3b8' }}>Pasajero:</Text>
                  <Text style={{ color: '#f8fafc' }}>{viaje.pasajero_nombre} {viaje.pasajero_apellido}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={{ color: '#94a3b8' }}>Distancia:</Text>
                  <Text style={{ color: '#f8fafc' }}>{Number(viaje.distancia_km || 0).toFixed(2)} km</Text>
                </View>
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>Cobrado:</Text>
                  <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 16 }}>${Number(viaje.monto_calculado || 0).toFixed(2)}</Text>
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
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#10b981',
};

const lightTheme = {
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#10b981',
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
