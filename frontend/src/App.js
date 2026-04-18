import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminDashboard from "@/pages/AdminDashboard";
import BuyerDashboard from "@/pages/BuyerDashboard";
import SellerDashboard from "@/pages/SellerDashboard";
import PendingApproval from "@/pages/PendingApproval";
import Footer from "@/components/Footer";

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <div className="noise-overlay" />
        
        <BrowserRouter>
          <ScrollToTop />
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="buyer">
                <BuyerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/seller" element={
              <ProtectedRoute requiredRole="seller">
                <SellerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/pending-approval" element={<PendingApproval />} />
          </Routes>
          <Footer />
        </BrowserRouter>
        
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
