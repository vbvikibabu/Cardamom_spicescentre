import "@/App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
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
import AuctionList from "@/pages/AuctionList";
import AuctionRoom from "@/pages/AuctionRoom";
import Footer from "@/components/Footer";

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
      <h1 className="text-7xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <div className="noise-overlay" />
        
        <BrowserRouter>
          <ScrollToTop />
          <Navbar />
          <div className="pb-20 md:pb-0">
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
            <Route path="/auctions" element={<AuctionList />} />
            <Route path="/auctions/:eventId" element={<AuctionRoom />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
          <Footer />
          <BottomNav />
        </BrowserRouter>
        
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
