import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Catalog from './pages/Catalog'
import ProductPage from './pages/ProductPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/products/:id" element={<ProductPage />} />
      </Routes>
    </BrowserRouter>
  )
}
