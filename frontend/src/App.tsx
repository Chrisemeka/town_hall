
import { Routes, Route } from 'react-router-dom'
import Home from './pages/home'
import Login from './pages/login'
import SignUp from './pages/sign_up'

const App = () => {
  return (
    <div className='min-h-screen bg-gray-50'>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<SignUp />} />
        {/* Add a catch-all route for 404 */}
        <Route path="*" element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-gray-600 mb-4">Page not found</p>
              <a href="/" className="text-blue-600 hover:text-blue-800">Go back home</a>
            </div>
          </div>
        } />
      </Routes>
    </div>
  )
}

export default App