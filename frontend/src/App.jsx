import { useState, useEffect } from 'react';

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetch('http://localhost:8080/api/tasks')
      .then(response => response.json())
      .then(data => setTasks(data))
      .catch(error => console.error("Error fetching tasks:", error));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newTask = { title, description, status: 'TODO' };

    fetch('http://localhost:8080/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    })
      .then(response => response.json())
      .then(savedTask => {
        setTasks([...tasks, savedTask]); 
        setTitle(''); 
        setDescription('');
      })
      .catch(error => console.error("Error saving task:", error));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-8">
          TaskFlow Manager
        </h1>
        
        {/* Form Section */}
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 mb-8 flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Task Title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
          <input 
            type="text" 
            placeholder="Description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required 
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out"
          >
            Add Task
          </button>
        </form>

        {/* Task List Section */}
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-center text-gray-500 italic">No tasks yet. Create one above!</p>
          ) : null}
          
          {tasks.map(task => (
            <div key={task.id} className="bg-white shadow-sm border border-gray-200 rounded-lg p-5 hover:shadow-md transition">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold text-gray-800">{task.title}</h3>
                <span className="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                  {task.status}
                </span>
              </div>
              <p className="text-gray-600">{task.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;