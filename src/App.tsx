import './App.css'

function App() {
  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="page-title">
        <header className="intro__header">
          <h1 id="page-title">حاسبة المرتب في مصر</h1>
          <p className="intro__english-title" lang="en" dir="ltr">
            Egypt Salary Calculator
          </p>
        </header>

        <p className="intro__status">
          الحاسبة قيد التطوير حاليًا، وستكون متاحة قريبًا.
        </p>
      </section>
    </main>
  )
}

export default App
