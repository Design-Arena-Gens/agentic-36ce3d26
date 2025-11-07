'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Upload, Download, Sparkles, ShoppingCart, Package, ListChecks } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface CatalogItem {
  [key: string]: string | number
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [inputText, setInputText] = useState('')
  const [catalogData, setCatalogData] = useState<CatalogItem[]>([])
  const [rawData, setRawData] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'catalog'>('chat')
  const recognitionRef = useRef<any>(null)
  const synthesisRef = useRef<SpeechSynthesis | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result) => result.transcript)
            .join('')

          setInputText(transcript)
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          if (isListening) {
            recognitionRef.current.start()
          }
        }
      }
      synthesisRef.current = window.speechSynthesis
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isListening])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      recognitionRef.current?.start()
      setIsListening(true)
    }
  }

  const speak = (text: string) => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.1
      utterance.pitch = 1
      utterance.volume = 1
      synthesisRef.current.speak(utterance)
    }
  }

  const handleSendMessage = async () => {
    if (!inputText.trim()) return

    const userMessage: Message = {
      role: 'user',
      content: inputText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsProcessing(true)
    const currentInput = inputText
    setInputText('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          catalogData,
          rawData
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      speak(data.response)

      if (data.updatedCatalog) {
        setCatalogData(data.updatedCatalog)
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      const workbook = XLSX.read(data, { type: 'binary' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(worksheet)
      setCatalogData(json as CatalogItem[])

      const message: Message = {
        role: 'assistant',
        content: `Catalog loaded successfully! I found ${json.length} items. You can now provide raw data and I'll help you fill in the details for Amazon, Flipkart, Meesho, and Myntra.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, message])
      speak(message.content)
    }
    reader.readAsBinaryString(file)
  }

  const handleDownloadCatalog = () => {
    if (catalogData.length === 0) return

    const worksheet = XLSX.utils.json_to_sheet(catalogData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalog')
    XLSX.writeFile(workbook, `catalog_${Date.now()}.xlsx`)
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold mb-4 glow text-jarvis-primary">
            J.A.R.V.I.S
          </h1>
          <p className="text-xl text-gray-300">
            Just A Rather Very Intelligent System
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Your personal AI assistant for daily tasks and e-commerce management
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-6 gap-4">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'chat'
                ? 'jarvis-border bg-jarvis-primary/10 text-jarvis-primary'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <ListChecks className="inline mr-2" size={20} />
            Daily Tasks
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'catalog'
                ? 'jarvis-border bg-jarvis-primary/10 text-jarvis-primary'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <ShoppingCart className="inline mr-2" size={20} />
            Catalog Manager
          </button>
        </div>

        {/* Main Content */}
        <div className="jarvis-border rounded-xl p-6 bg-black/40 backdrop-blur-sm">
          {activeTab === 'chat' ? (
            <>
              {/* Chat Messages */}
              <div className="h-96 overflow-y-auto mb-6 space-y-4 px-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 mt-20">
                    <Sparkles className="mx-auto mb-4 pulse-glow" size={48} />
                    <p className="text-lg">Hello! I'm JARVIS, your personal AI assistant.</p>
                    <p className="mt-2">I can help you with:</p>
                    <ul className="mt-4 space-y-2 text-left max-w-md mx-auto">
                      <li>✓ Daily task management and reminders</li>
                      <li>✓ E-commerce catalog processing</li>
                      <li>✓ Product listing for Amazon, Flipkart, Meesho, Myntra</li>
                      <li>✓ Data organization and formatting</li>
                    </ul>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-2xl px-4 py-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-jarvis-secondary text-white'
                            : 'bg-gray-800 text-gray-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs mt-1 opacity-60">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Area */}
              <div className="flex gap-4">
                <button
                  onClick={toggleListening}
                  className={`p-4 rounded-lg transition-all ${
                    isListening
                      ? 'bg-red-600 hover:bg-red-700 pulse-glow'
                      : 'bg-jarvis-primary hover:bg-jarvis-secondary'
                  } text-white`}
                >
                  {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type or speak your request..."
                  className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-jarvis-primary"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isProcessing || !inputText.trim()}
                  className="px-8 py-3 bg-jarvis-primary hover:bg-jarvis-secondary disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all"
                >
                  {isProcessing ? 'Processing...' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Catalog Management */}
              <div className="space-y-6">
                {/* File Upload and Actions */}
                <div className="flex gap-4 items-center justify-between">
                  <div className="flex gap-4">
                    <label className="px-6 py-3 bg-jarvis-primary hover:bg-jarvis-secondary text-white font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-2">
                      <Upload size={20} />
                      Upload Catalog
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={handleDownloadCatalog}
                      disabled={catalogData.length === 0}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                    >
                      <Download size={20} />
                      Download Catalog
                    </button>
                  </div>
                  <div className="text-gray-300">
                    <Package className="inline mr-2" size={20} />
                    {catalogData.length} items
                  </div>
                </div>

                {/* Raw Data Input */}
                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Raw Product Data (Paste your data here)
                  </label>
                  <textarea
                    value={rawData}
                    onChange={(e) => setRawData(e.target.value)}
                    placeholder="Paste your raw product data here... I'll help you format it for Amazon, Flipkart, Meesho, and Myntra listings."
                    className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-jarvis-primary resize-none"
                  />
                </div>

                {/* Catalog Preview */}
                {catalogData.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs uppercase bg-gray-800 text-gray-400">
                        <tr>
                          {Object.keys(catalogData[0]).map((key) => (
                            <th key={key} className="px-4 py-3">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catalogData.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-900">
                            {Object.values(item).map((value, vidx) => (
                              <td key={vidx} className="px-4 py-3">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {catalogData.length > 10 && (
                      <p className="text-center text-gray-500 mt-4">
                        Showing 10 of {catalogData.length} items
                      </p>
                    )}
                  </div>
                )}

                {catalogData.length === 0 && (
                  <div className="text-center text-gray-400 py-12">
                    <Package className="mx-auto mb-4" size={48} />
                    <p className="text-lg">No catalog loaded</p>
                    <p className="mt-2">Upload a catalog file to get started</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              setInputText('What tasks do I have for today?')
              setActiveTab('chat')
            }}
            className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-all border border-gray-700 hover:border-jarvis-primary"
          >
            <h3 className="font-semibold text-jarvis-primary mb-1">Today's Tasks</h3>
            <p className="text-sm text-gray-400">View daily schedule</p>
          </button>
          <button
            onClick={() => {
              setInputText('Help me prepare product listings')
              setActiveTab('catalog')
            }}
            className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-all border border-gray-700 hover:border-jarvis-primary"
          >
            <h3 className="font-semibold text-jarvis-primary mb-1">Prepare Listings</h3>
            <p className="text-sm text-gray-400">Format catalog data</p>
          </button>
          <button
            onClick={() => {
              setInputText('Show me Amazon listing requirements')
              setActiveTab('chat')
            }}
            className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-all border border-gray-700 hover:border-jarvis-primary"
          >
            <h3 className="font-semibold text-jarvis-primary mb-1">Platform Rules</h3>
            <p className="text-sm text-gray-400">E-commerce guidelines</p>
          </button>
          <button
            onClick={() => {
              setInputText('Analyze my catalog for missing data')
              setActiveTab('catalog')
            }}
            className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-all border border-gray-700 hover:border-jarvis-primary"
          >
            <h3 className="font-semibold text-jarvis-primary mb-1">Data Check</h3>
            <p className="text-sm text-gray-400">Find missing fields</p>
          </button>
        </div>
      </div>
    </div>
  )
}
