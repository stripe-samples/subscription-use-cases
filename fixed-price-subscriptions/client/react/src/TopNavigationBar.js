import React from 'react';
import './App.css';

function TopNavigationBar(props) {
  return (
    <nav className="flex items-center justify-between flex-wrap">
      <svg
        width="79px"
        height="24px"
        viewBox="0 0 79 24"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
      >
        {/* <use href="https://storage.googleapis.com/stripe-sample-images/logo-pasha.svg" /> */}
      </svg>

      <div>
        <button
          className="bg-white hover:bg-white hover:shadow-outline hover:text-pasha hover:border hover:border-black focus:shadow-outline text-pasha focus:bg-white focus:text-pasha font-light py-2 px-4 rounded"
          type="button"
        >
          {props.loggedIn ? 'Sign out' : 'Sign in'}
        </button>
      </div>
    </nav>
  );
}

export default TopNavigationBar;
