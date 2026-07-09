import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Complexity from './pages/Complexity.jsx'
import Fehm from './pages/Fehm.jsx'
import RaceModule from './pages/RaceModule.jsx'
import ArrayModule from './pages/modules/ArrayModule.jsx'
import RecursionModule from './pages/modules/RecursionModule.jsx'
import DPModule from './pages/modules/DPModule.jsx'
import GraphModule from './pages/modules/GraphModule.jsx'
import TreeModule from './pages/modules/TreeModule.jsx'
import CustomCodeModule from './pages/modules/CustomCodeModule.jsx'

function Protected({ children }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      <Route path="/complexity" element={<Protected><Complexity /></Protected>} />
      <Route path="/fehm" element={<Protected><Fehm /></Protected>} />
      <Route path="/race" element={<Protected><RaceModule /></Protected>} />
      <Route path="/module/array" element={<Protected><ArrayModule /></Protected>} />
      <Route path="/module/recursion" element={<Protected><RecursionModule /></Protected>} />
      <Route path="/module/dp" element={<Protected><DPModule /></Protected>} />
      <Route path="/module/graph" element={<Protected><GraphModule /></Protected>} />
      <Route path="/module/tree" element={<Protected><TreeModule /></Protected>} />
      <Route path="/module/custom" element={<Protected><CustomCodeModule /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
