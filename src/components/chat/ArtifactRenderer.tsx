import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Image } from 'react-native'
import { WebView } from 'react-native-webview'
import { Copy, Check, Code2, Globe, GitBranch, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'

interface Props {
  artifactType: string // 'html' | 'code' | 'mermaid' | 'image' | 'svg'
  source: string
  title?: string
  language?: string
}

export function ArtifactRenderer({ artifactType, source, title, language }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const { width } = useWindowDimensions()

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [source])

  const typeLabel = artifactType === 'html' ? 'HTML'
    : artifactType === 'code' ? (language || 'Code').toUpperCase()
    : artifactType === 'mermaid' ? 'Diagram'
    : artifactType === 'image' ? 'Image'
    : artifactType === 'svg' ? 'SVG'
    : 'Artifact'

  const TypeIconComponent = artifactType === 'html' ? Globe
    : artifactType === 'code' ? Code2
    : artifactType === 'mermaid' ? GitBranch
    : ImageIcon

  // Render content based on type
  const renderContent = () => {
    switch (artifactType) {
      case 'html':
      case 'svg': {
        // Wrap SVG/HTML in a full HTML document for WebView
        const html = source.trim().startsWith('<html') || source.trim().startsWith('<!DOCTYPE')
          ? source
          : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff;}</style></head><body>${source}</body></html>`
        return (
          <WebView
            source={{ html }}
            style={{ width: width - 80, height: 250 }}
            scrollEnabled={false}
            javaScriptEnabled={false}
          />
        )
      }

      case 'mermaid': {
        // Render mermaid via WebView with mermaid.js CDN
        const mermaidHtml = `<!DOCTYPE html><html><head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
          <style>body{margin:0;padding:16px;background:#fff;display:flex;justify-content:center;}</style>
        </head><body>
          <div class="mermaid">${source}</div>
          <script>mermaid.initialize({startOnLoad:true,theme:'default'});</script>
        </body></html>`
        return (
          <WebView
            source={{ html: mermaidHtml }}
            style={{ width: width - 80, height: 300 }}
            javaScriptEnabled={true}
          />
        )
      }

      case 'image': {
        return (
          <Image
            source={{ uri: source }}
            style={{ width: width - 80, height: 200 }}
            resizeMode="contain"
          />
        )
      }

      case 'code': {
        return (
          <View style={styles.codeBlock}>
            {language ? (
              <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>{language}</Text>
              </View>
            ) : null}
            <Text style={styles.codeText} selectable>{source}</Text>
          </View>
        )
      }

      default: {
        // Fallback: try WebView for unknown types
        const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:8px;font-family:sans-serif;}</style></head><body>${source}</body></html>`
        return (
          <WebView
            source={{ html }}
            style={{ width: width - 80, height: 200 }}
            javaScriptEnabled={false}
          />
        )
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <TypeIconComponent size={14} color="#6366f1" />
        <Text style={styles.title} numberOfLines={1}>{title || typeLabel}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleCopy} style={styles.iconBtn}>
            {copied
              ? <Check size={14} color="#22c55e" />
              : <Copy size={14} color="#9ca3af" />
            }
          </Pressable>
          {expanded
            ? <ChevronUp size={14} color="#9ca3af" />
            : <ChevronDown size={14} color="#9ca3af" />
          }
        </View>
      </Pressable>

      {/* Content */}
      {expanded && (
        <View style={styles.content}>
          {renderContent()}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  codeBlock: {
    width: '100%',
    backgroundColor: '#1e1e2e',
  },
  codeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d3f',
  },
  codeLanguage: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeText: {
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#e2e8f0',
    lineHeight: 18,
  },
})
