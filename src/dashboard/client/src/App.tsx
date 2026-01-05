import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Box, Server as ServerIcon, RefreshCw } from 'lucide-react'
import axios from 'axios'
import './index.css'

// Types
interface Project {
  name: string
  port?: number
  domain?: string
  createdAt: string
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // New Project State
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('nextjs')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/projects')
      setProjects(res.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      await axios.delete(`/api/projects/${name}`)
      fetchProjects()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName) return
    setCreating(true)
    try {
      await axios.post('/api/projects', { name: newProjectName, template: selectedTemplate })
      setShowNewProject(false)
      setNewProjectName('')
      fetchProjects()
    } catch (error) {
      alert('Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="container navbar-content">
          <div className="brand">
            <div className="brand-icon">
              <ServerIcon size={20} color="white" />
            </div>
            <span>Arkli <span style={{ color: 'var(--accent)' }}>Panel</span></span>
          </div>
          <div>
            <button onClick={fetchProjects} className="btn-refresh">
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </nav>

      <main className="container main-content">
        <header className="header">
          <h1>My Projects</h1>
          <p>Manage your deployed applications and services.</p>
        </header>

        {loading && projects.length === 0 ? (
          <div className="flex-center" style={{ padding: '5rem' }}>
            <div className="animate-pulse flex flex-col items-center">
              <div className="skeleton skeleton-bar"></div>
              <div className="skeleton skeleton-box"></div>
            </div>
          </div>
        ) : (
          <div className="grid">
            <AnimatePresence>
              {projects.map((project) => (
                <motion.div
                  key={project.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="card"
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="card-header">
                    <div className="icon-box">
                      <Box color="var(--accent)" size={24} />
                    </div>
                    <div className="status-badge">
                      <span className="status-dot"></span>
                      <span>Running</span>
                    </div>
                  </div>

                  <h3>{project.name}</h3>
                  <p>{project.domain || 'No domain linked'}</p>

                  <div className="actions">
                    <button className="btn btn-secondary">
                      <Terminal size={14} /> Logs
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.name); }}
                      className="btn btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* New Project Card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card card-new"
              onClick={() => setShowNewProject(true)}
            >
              <div className="plus-icon">
                <span>+</span>
              </div>
              <div>
                <h3>New Project</h3>
                <p>Deploy from App Store</p>
              </div>
            </motion.div>
          </div>
        )}
      </main>


      {/* New Project Modal */}
      {showNewProject && (
        <div className="modal-overlay" onClick={() => setShowNewProject(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Deploy New Project</h2>
              <button onClick={() => setShowNewProject(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                    border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white'
                  }}
                  placeholder="my-awesome-app"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {['nextjs', 'wordpress', 'ghost'].map(t => (
                  <div
                    key={t}
                    onClick={() => setSelectedTemplate(t)}
                    style={{
                      border: selectedTemplate === t ? '2px solid var(--accent)' : '1px solid var(--border)',
                      padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer',
                      background: selectedTemplate === t ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{t}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>One-click install</div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateProject}
                disabled={creating || !newProjectName}
                style={{
                  width: '100%', padding: '0.75rem', background: 'var(--accent)',
                  border: 'none', borderRadius: '0.5rem', color: 'white', fontWeight: 'bold',
                  cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1
                }}
              >
                {creating ? 'Deploying...' : 'Deploy Project'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{selectedProject.name}</h2>
              <button onClick={() => setSelectedProject(null)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p>Project details and terminal would go here...</p>
              <div className="terminal">
                $ docker logs -f {selectedProject.name}<br />
                [System] Container starting...<br />
                [System] Listening on port {selectedProject.port || 3000}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default App
