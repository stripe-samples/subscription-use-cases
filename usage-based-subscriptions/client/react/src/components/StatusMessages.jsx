// A small set of helpers for displaying messages while in development.
import React, { useReducer, useRef, useLayoutEffect } from 'react';

const StatusMessages = ({ messages }) => {
  const scrollRef = useRef(null);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  return messages.length ? (
    <div ref={scrollRef} id="messages" role="alert">
      {messages.map((m, i) => (
        <div key={i}>{maybeLink(m)}</div>
      ))}
    </div>
  ) : (
    ''
  );
};

const maybeLink = (m) => {
  let dashboardBase = '';
  if (m.includes('cus_'))
    dashboardBase = 'https://dashboard.stripe.com/test/customers/';
  else if (m.includes('sub_')) {
    dashboardBase = 'https://dashboard.stripe.com/test/subscriptions/';
  } else if (m.includes('mtr_')) {
    dashboardBase = 'https://dashboard.stripe.com/test/meters/';
  } else if (m.includes('price_')) {
    dashboardBase = 'https://dashboard.stripe.com/test/prices/';
  }
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: m.replace(
          /((cus_|sub_|mtr_|price_)(\S*)\b)/g,
          `<a href="${dashboardBase}$1" target="_blank">$1</a>`
        ),
      }}
    ></span>
  );
};

const useMessages = () => {
  return useReducer((messages, message) => {
    return [...messages, message];
  }, []);
};

export default StatusMessages;
export { useMessages };
