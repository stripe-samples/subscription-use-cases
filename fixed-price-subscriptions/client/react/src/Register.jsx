import React, { useState } from 'react';
import './App.css';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [email, setEmail] = useState('jenny.rosen@example.com');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch('api/create-customer', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
      }),
    }).then(r => r.json());

    navigate('/prices', { replace: false });
  };

  return (
    <main>
      <h1>Sample Photo Service</h1>

      <img src="https://picsum.photos/280/320?random=4" alt="picsum generated" width="140" height="160" />

      <p>
        Unlimited photo hosting, and more. Cancel anytime.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="text"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required />
        </label>

        <button type="submit">
          Register
        </button>
      </form>
    </main>
  );
}

export default Register;
