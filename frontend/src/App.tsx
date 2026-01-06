import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-primary mb-4">
                  BFIN - Banking Finance
                </h1>
                <p className="text-muted-foreground">
                  Sistema de Gerenciamento Financeiro Pessoal
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Ambiente de desenvolvimento - Frontend configurado com sucesso!
                </p>
              </div>
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
