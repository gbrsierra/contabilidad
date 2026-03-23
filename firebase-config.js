// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAw-P4KmWt9SkSMxSkEVj2VptTDmhecGWY",
    authDomain: "contabilidad-f9e73.firebaseapp.com",
    projectId: "contabilidad-f9e73",
    storageBucket: "contabilidad-f9e73.firebasestorage.app",
    messagingSenderId: "897326277743",
    appId: "1:897326277743:web:a9c0eafb9802be3886599a"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Habilitar persistencia offline para que funcione sin conexión ("sincronización automática" robusta)
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
