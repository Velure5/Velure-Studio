console.log('app.js loaded');

// AI API Configuration - User will input their own API key
let userApiKey = localStorage.getItem('geminiApiKey') || '';

// Define App component for in-browser React
const App = () => {
  // --- Chat State and Logic ---
  const [chatHistory, setChatHistory] = React.useState([
    { role: 'model', parts: [{ text: "Welcome to Velure Studio. Let's craft your perfect visual. To begin, what is the general context or concept of the image you'd like to create?" }] },
  ]);
  const [messageInput, setMessageInput] = React.useState('');
  const [isChatLoading, setIsChatLoading] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [systemPrompt] = React.useState(`
You are Velure Studio, a world-class AI image prompt engineer and creative director trusted by high-end brands to craft flawless prompts for commercial-grade, studio-quality image generation. Your job is to extract a user’s full creative vision and translate it into a detailed, stunning image prompt that could be used for luxury brand campaigns, fashion ads, or editorial studio shots. Your outputs must reflect a Vogue-level standard: refined, specific, and visually coherent.

Begin by asking the user: “What is the general context or concept of the image you want to create?” (e.g., fashion ad, skincare product, luxury lifestyle, editorial cover, etc.)

Then, guide the user step-by-step through the following categories to fully understand their vision. Ask one category at a time, and after getting a response, move to the next:

1. Mood & Atmosphere:
- Ask: “What’s the emotional tone or mood you’re going for?” (e.g., moody, romantic, luxurious, bold, ethereal)

2. Camera Details:
- Ask: “What camera angle or framing do you envision?” (e.g., close-up portrait, wide shot, bird’s-eye view, cinematic)
- Optional: “Any specific lens style or focal length?” (e.g., 85mm, fisheye, ultra-wide)

3. Lighting:
- Ask: “What kind of lighting should the scene have?” (e.g., soft studio lighting, harsh contrast, golden hour sunlight, backlit, neon glow)

4. Color Palette:
- Ask: “What main colors or tones should dominate the image?” (e.g., all-black, earth tones, pastel pinks, monochrome, vibrant reds)

5. Background & Setting:
- Ask: “Where is the image set? What’s in the background?” (e.g., minimal white studio, luxury interior, urban rooftop, desert landscape, Paris street)
- Optional: “Any props or visual elements in the environment?”

6. Model Appearance:
- Ask: “What does the model (or models) look like?” (gender, skin tone, facial features, hair style, age, body type)
- Ask: “How many models are in the shot?”
- Ask: “What kind of expression or pose should they have?”

7. Styling & Wardrobe:
- Ask: “What are they wearing?” (e.g., couture dress, streetwear, swimwear, leather jacket, activewear)
- Optional: “Any specific fashion style, brand references, or accessories?”

8. Overall Vibe:
- Ask: “Any overall aesthetic or creative direction you want to emphasize?” (e.g., futuristic, nostalgic, surreal, minimal, editorial)

Once all answers are collected, synthesize them into a world-class, studio-level image prompt. Prioritize clarity, creativity, and cohesion. Always aim for high-end fashion or commercial quality.
  `);
  const [tempApiKey, setTempApiKey] = React.useState(userApiKey);
  const [copiedMessageIndex, setCopiedMessageIndex] = React.useState(null);

  const chatWindowRef = React.useRef(null);

  React.useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const sendMessage = async () => {
    if (messageInput.trim() === '' || isChatLoading) return;

    // Check if API key is set
    if (!userApiKey) {
      setChatHistory((prevHistory) => [...prevHistory, { 
        role: 'model', 
        parts: [{ text: 'Please set your Gemini API key in the settings (⚙️) to start chatting.' }] 
      }]);
      return;
    }

    const userMessage = { role: 'user', parts: [{ text: messageInput }] };
    setChatHistory((prevHistory) => [...prevHistory, userMessage]);
    setMessageInput('');
    setIsChatLoading(true);

    const chatPayload = {
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...chatHistory,
        userMessage,
      ],
    };

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

      const retryFetch = async (url, options, retries = 3, delay = 1000) => {
        try {
          const response = await fetch(url, options);
          if (response.status === 429 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryFetch(url, options, retries - 1, delay * 2);
          }
          return response;
        } catch (error) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryFetch(url, options, retries - 1, delay * 2);
          }
          throw error;
        }
      };

      const response = await retryFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
        const modelResponse = result.candidates[0].content.parts[0].text;
        setChatHistory((prevHistory) => [...prevHistory, { role: 'model', parts: [{ text: modelResponse }] }]);
      } else {
        setChatHistory((prevHistory) => [...prevHistory, { role: 'model', parts: [{ text: 'Sorry, I couldn\'t generate a response. Please try again.' }] }]);
      }
    } catch (error) {
      console.error('Error during API call:', error);
      setChatHistory((prevHistory) => [...prevHistory, { role: 'model', parts: [{ text: 'An error occurred while connecting to the server. Please check your network and try again.' }] }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const saveSettings = () => {
    userApiKey = tempApiKey;
    localStorage.setItem('geminiApiKey', tempApiKey);
    setShowSettingsModal(false);
  };

  const copyToClipboard = (text, index) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    setCopiedMessageIndex(index);
    setTimeout(() => setCopiedMessageIndex(null), 2000);
  };

  // --- Image Generation State and Logic ---
  const [imagePrompt, setImagePrompt] = React.useState('');
  const [generatedImage, setGeneratedImage] = React.useState(null);
  const [isImageLoading, setIsImageLoading] = React.useState(false);

  const generateImage = async () => {
    if (imagePrompt.trim() === '' || isImageLoading) return;

    // Check if API key is set
    if (!userApiKey) {
      alert('Please set your Gemini API key in the settings (⚙️) to generate images.');
      return;
    }

    setGeneratedImage(null); // Clear previous image
    setIsImageLoading(true);

    const payload = {
      contents: [{
        parts: [{
          text: imagePrompt
        }]
      }],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      }
    };
    
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateContent?key=${userApiKey}`;

      const retryFetch = async (url, options, retries = 3, delay = 1000) => {
        try {
          const response = await fetch(url, options);
          if (response.status === 429 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryFetch(url, options, retries - 1, delay * 2);
          }
          return response;
        } catch (error) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryFetch(url, options, retries - 1, delay * 2);
          }
          throw error;
        }
      };

      const response = await retryFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Image generation response:', result);
      
      if (result.candidates && result.candidates.length > 0 && 
          result.candidates[0].content && result.candidates[0].content.parts && 
          result.candidates[0].content.parts.length > 0 && 
          result.candidates[0].content.parts[0].inlineData) {
        const imageData = result.candidates[0].content.parts[0].inlineData.data;
        const imageUrl = `data:image/png;base64,${imageData}`;
        setGeneratedImage(imageUrl);
      } else {
        console.error('Error generating image: Invalid API response format.', result);
        setGeneratedImage('error');
      }

    } catch (error) {
      console.error('Error during image generation API call:', error);
      setGeneratedImage('error');
    } finally {
      setIsImageLoading(false);
    }
  };

  return React.createElement('div', {
    className: "flex flex-col min-h-screen bg-neutral-950 text-neutral-50 font-sans antialiased items-center p-4 gap-8"
  }, [
    // Top bar with the title and settings button
    React.createElement('header', {
      key: 'header',
      className: "w-full max-w-4xl flex justify-between items-center p-4"
    }, [
      React.createElement('h1', {
        key: 'title',
        className: "text-xl font-bold tracking-widest uppercase"
      }, "Velure Studio"),
      React.createElement('button', {
        key: 'settings',
        onClick: () => {
          setTempApiKey(userApiKey);
          setShowSettingsModal(true);
        },
        className: "p-2 bg-neutral-800 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors duration-300"
      }, React.createElement('span', { className: "w-5 h-5" }, "⚙"))
    ]),

    // Main content area: chatbox and image generation sections
    React.createElement('div', {
      key: 'main-content',
      className: "flex flex-col w-full max-w-4xl gap-8"
    }, [
      // Chatbox Section
      React.createElement('div', {
        key: 'chatbox',
        className: "flex flex-col h-[60vh] bg-neutral-800/50 rounded-lg shadow-xl backdrop-blur-xl border border-neutral-700/50"
      }, [
        React.createElement('main', {
          key: 'chat-window',
          ref: chatWindowRef,
          className: "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
        }, [
          ...chatHistory.map((message, index) =>
            React.createElement('div', {
              key: `message-${index}`,
              className: `flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`
            }, [
              React.createElement('div', {
                key: `message-content-${index}`,
                className: `flex items-center gap-2 max-w-3/4 md:max-w-1/2 p-3 rounded-lg shadow-sm ${
                  message.role === 'user'
                    ? 'bg-neutral-700 text-neutral-100 rounded-br-none'
                    : 'bg-neutral-900 text-neutral-200 rounded-bl-none'
                }`
              }, [
                React.createElement('p', {
                  key: `text-${index}`,
                  className: "text-sm"
                }, message.parts[0].text),
                message.role === 'model' && React.createElement('button', {
                  key: `copy-${index}`,
                  onClick: () => copyToClipboard(message.parts[0].text, index),
                  className: `ml-2 p-1 rounded-md transition-all duration-300 ${
                    copiedMessageIndex === index
                      ? 'bg-green-500 text-white'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                  }`,
                  title: "Copy to clipboard"
                }, React.createElement('span', { className: "w-4 h-4" }, "📋"))
              ])
            ])
          ),
          isChatLoading && React.createElement('div', {
            key: 'loading',
            className: "flex justify-start"
          }, [
            React.createElement('div', {
              key: 'loading-content',
              className: "p-3 rounded-lg rounded-bl-none bg-neutral-900 text-neutral-200 shadow-sm animate-pulse"
            }, [
              React.createElement('p', {
                key: 'loading-text',
                className: "text-sm"
              }, "Thinking...")
            ])
          ])
        ]),
        React.createElement('footer', {
          key: 'chat-footer',
          className: "flex p-4 border-t border-neutral-700"
        }, [
          React.createElement('input', {
            key: 'message-input',
            type: "text",
            value: messageInput,
            onChange: (e) => setMessageInput(e.target.value),
            onKeyDown: (e) => e.key === 'Enter' && sendMessage(),
            placeholder: userApiKey ? "Send a message..." : "Set API key in settings to chat...",
            className: "flex-1 bg-neutral-900/50 text-neutral-100 placeholder-neutral-500 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-colors duration-300",
            disabled: isChatLoading || !userApiKey
          }),
          React.createElement('button', {
            key: 'send-button',
            onClick: sendMessage,
            className: "ml-2 px-6 py-2 bg-neutral-700 text-neutral-100 rounded-full font-semibold hover:bg-neutral-600 transition-all duration-300",
            disabled: isChatLoading || !userApiKey
          }, "Send")
        ])
      ]),

      // Image Generation Section
      React.createElement('div', {
        key: 'image-generation',
        className: "flex flex-col md:flex-row bg-neutral-800/50 rounded-lg shadow-xl backdrop-blur-xl border border-neutral-700/50 p-4"
      }, [
        React.createElement('div', {
          key: 'image-input',
          className: "flex-1 flex flex-col gap-4"
        }, [
          React.createElement('h3', {
            key: 'image-title',
            className: "text-lg font-bold text-neutral-200"
          }, "Image Generation"),
          React.createElement('textarea', {
            key: 'image-prompt',
            value: imagePrompt,
            onChange: (e) => setImagePrompt(e.target.value),
            placeholder: userApiKey ? "Enter image prompt..." : "Set API key in settings to generate images...",
            className: "flex-1 w-full bg-neutral-900/50 text-neutral-100 placeholder-neutral-500 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-colors duration-300 resize-none",
            disabled: isImageLoading || !userApiKey
          }),
          React.createElement('button', {
            key: 'generate-button',
            onClick: generateImage,
            className: "px-6 py-2 bg-neutral-700 text-neutral-100 rounded-full font-semibold hover:bg-neutral-600 transition-all duration-300",
            disabled: isImageLoading || !userApiKey
          }, isImageLoading ? 'Generating...' : 'Generate Image')
        ]),
        React.createElement('div', {
          key: 'image-display',
          className: "flex-1 flex flex-col justify-center items-center overflow-hidden p-4"
        }, [
          isImageLoading ? 
            React.createElement('div', {
              key: 'image-loading',
              className: "text-neutral-400 text-lg animate-pulse"
            }, "Generating image...") :
          generatedImage ? 
            (generatedImage === 'error' ? 
              React.createElement('div', {
                key: 'image-error',
                className: "text-red-400 text-lg"
              }, "Error generating image. Please try again.") :
              React.createElement('img', {
                key: 'generated-image',
                src: generatedImage,
                alt: "Generated by AI",
                className: "max-w-full max-h-full object-contain rounded-lg shadow-md animate-fade-in"
              })
            ) :
            React.createElement('div', {
              key: 'image-placeholder',
              className: "text-neutral-400 text-lg italic"
            }, "Your image will appear here.")
        ])
      ])
    ]),

    // Settings Modal with glassmorphism effect
    showSettingsModal && React.createElement('div', {
      key: 'settings-modal',
      className: "fixed inset-0 bg-neutral-950 bg-opacity-70 flex items-center justify-center p-4"
    }, [
      React.createElement('div', {
        key: 'modal-content',
        className: "bg-neutral-800/50 p-6 rounded-lg shadow-2xl w-full max-w-xl backdrop-blur-xl border border-neutral-700/50"
      }, [
        React.createElement('h2', {
          key: 'modal-title',
          className: "text-lg font-bold mb-4"
        }, "Settings"),
        
        // API Key Section
        React.createElement('div', {
          key: 'api-key-section',
          className: "mb-4"
        }, [
          React.createElement('label', {
            key: 'api-key-label',
            className: "block text-sm font-medium text-neutral-300 mb-2"
          }, "Gemini API Key"),
          React.createElement('input', {
            key: 'api-key-input',
            type: "password",
            value: tempApiKey,
            onChange: (e) => setTempApiKey(e.target.value),
            className: "w-full bg-neutral-900/50 text-neutral-100 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-600",
            placeholder: "Enter your Gemini API key..."
          }),
          React.createElement('p', {
            key: 'api-key-help',
            className: "text-xs text-neutral-400 mt-1"
          }, "Get your API key from https://makersuite.google.com/app/apikey")
        ]),

        React.createElement('div', {
          key: 'modal-buttons',
          className: "mt-4 flex justify-end space-x-2"
        }, [
          React.createElement('button', {
            key: 'cancel-button',
            onClick: () => setShowSettingsModal(false),
            className: "px-4 py-2 rounded-full text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors duration-200"
          }, "Cancel"),
          React.createElement('button', {
            key: 'save-button',
            onClick: saveSettings,
            className: "px-4 py-2 rounded-full bg-neutral-700 text-neutral-100 font-semibold hover:bg-neutral-600 transition-colors duration-200"
          }, "Save")
        ])
      ])
    ])
  ]);
};
