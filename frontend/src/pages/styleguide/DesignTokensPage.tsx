import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AlertCircle, CheckCircle, Info, AlertTriangle, Sun, Moon } from "lucide-react"

// Color swatch component
function ColorSwatch({
  name,
  cssVar,
  className
}: {
  name: string
  cssVar: string
  className?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`w-full h-16 rounded-lg border border-border shadow-sm ${className}`}
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="text-xs">
        <p className="font-medium text-foreground">{name}</p>
        <p className="text-muted-foreground font-mono">{cssVar}</p>
      </div>
    </div>
  )
}

// Color scale component
function ColorScale({
  name,
  prefix
}: {
  name: string
  prefix: string
}) {
  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-foreground capitalize">{name}</h4>
      <div className="grid grid-cols-10 gap-2">
        {shades.map((shade) => (
          <div key={shade} className="flex flex-col gap-1">
            <div
              className="h-12 rounded-md border border-border"
              style={{ backgroundColor: `var(--${prefix}-${shade})` }}
            />
            <span className="text-xs text-muted-foreground text-center">{shade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DesignTokensPage() {
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className={`min-h-screen p-8 ${isDark ? 'dark' : ''}`}>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Design Tokens</h1>
            <p className="text-lg text-muted-foreground mt-2">
              BFIN Design System - Nubank-inspired purple fintech theme
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Semantic Colors */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Semantic Colors</h2>
            <p className="text-muted-foreground mt-1">Core colors used throughout the application</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <ColorSwatch name="Background" cssVar="--background" />
            <ColorSwatch name="Foreground" cssVar="--foreground" />
            <ColorSwatch name="Card" cssVar="--card" />
            <ColorSwatch name="Card Foreground" cssVar="--card-foreground" />
            <ColorSwatch name="Primary" cssVar="--primary" />
            <ColorSwatch name="Primary Foreground" cssVar="--primary-foreground" />
            <ColorSwatch name="Secondary" cssVar="--secondary" />
            <ColorSwatch name="Secondary Foreground" cssVar="--secondary-foreground" />
            <ColorSwatch name="Muted" cssVar="--muted" />
            <ColorSwatch name="Muted Foreground" cssVar="--muted-foreground" />
            <ColorSwatch name="Accent" cssVar="--accent" />
            <ColorSwatch name="Accent Foreground" cssVar="--accent-foreground" />
            <ColorSwatch name="Destructive" cssVar="--destructive" />
            <ColorSwatch name="Destructive Foreground" cssVar="--destructive-foreground" />
            <ColorSwatch name="Border" cssVar="--border" />
            <ColorSwatch name="Input" cssVar="--input" />
            <ColorSwatch name="Ring" cssVar="--ring" />
          </div>
        </section>

        {/* Status Colors */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Status Colors</h2>
            <p className="text-muted-foreground mt-1">Semantic colors for feedback and states</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ColorSwatch name="Success" cssVar="--success" />
            <ColorSwatch name="Success Foreground" cssVar="--success-foreground" />
            <ColorSwatch name="Warning" cssVar="--warning" />
            <ColorSwatch name="Warning Foreground" cssVar="--warning-foreground" />
            <ColorSwatch name="Info" cssVar="--info" />
            <ColorSwatch name="Info Foreground" cssVar="--info-foreground" />
            <ColorSwatch name="Destructive" cssVar="--destructive" />
            <ColorSwatch name="Destructive Foreground" cssVar="--destructive-foreground" />
          </div>
        </section>

        {/* Color Palettes */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Color Palettes</h2>
            <p className="text-muted-foreground mt-1">Complete color scales from 50 to 900</p>
          </div>

          <div className="space-y-8">
            <ColorScale name="Purple (Primary)" prefix="purple" />
            <ColorScale name="Gray (Neutral)" prefix="gray" />
            <ColorScale name="Green (Success)" prefix="green" />
            <ColorScale name="Red (Error)" prefix="red" />
            <ColorScale name="Yellow (Warning)" prefix="yellow" />
            <ColorScale name="Blue (Info)" prefix="blue" />
          </div>
        </section>

        {/* Chart Colors */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Chart Colors</h2>
            <p className="text-muted-foreground mt-1">Distinct colors for data visualization</p>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((num) => (
              <ColorSwatch key={num} name={`Chart ${num}`} cssVar={`--chart-${num}`} />
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Typography</h2>
            <p className="text-muted-foreground mt-1">Font sizes and weights</p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Font Sizes</h3>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">XS (0.75rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-sm text-muted-foreground">SM (0.875rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-base text-muted-foreground">Base (1rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-lg text-muted-foreground">LG (1.125rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-xl text-muted-foreground">XL (1.25rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-2xl text-muted-foreground">2XL (1.5rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-3xl text-muted-foreground">3XL (1.875rem) - <span className="text-foreground">The quick brown fox</span></p>
                  <p className="text-4xl text-muted-foreground">4XL (2.25rem) - <span className="text-foreground">The quick brown fox</span></p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Font Weights</h3>
                <div className="space-y-3">
                  <p className="font-normal text-foreground">Normal (400) - The quick brown fox jumps over the lazy dog</p>
                  <p className="font-medium text-foreground">Medium (500) - The quick brown fox jumps over the lazy dog</p>
                  <p className="font-semibold text-foreground">Semibold (600) - The quick brown fox jumps over the lazy dog</p>
                  <p className="font-bold text-foreground">Bold (700) - The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Border Radius */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Border Radius</h2>
            <p className="text-muted-foreground mt-1">Consistent rounded corners</p>
          </div>

          <div className="flex flex-wrap gap-6">
            {[
              { name: 'XS', var: '--radius-xs', value: '0.125rem' },
              { name: 'SM', var: '--radius-sm', value: '0.25rem' },
              { name: 'MD', var: '--radius-md', value: '0.375rem' },
              { name: 'LG', var: '--radius-lg', value: '0.5rem' },
              { name: 'XL', var: '--radius-xl', value: '0.75rem' },
              { name: '2XL', var: '--radius-2xl', value: '1rem' },
              { name: '3XL', var: '--radius-3xl', value: '1.5rem' },
              { name: 'Full', var: '--radius-full', value: '9999px' },
            ].map((radius) => (
              <div key={radius.name} className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 bg-primary"
                  style={{ borderRadius: `var(${radius.var})` }}
                />
                <span className="text-sm font-medium text-foreground">{radius.name}</span>
                <span className="text-xs text-muted-foreground">{radius.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Shadows */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Shadows</h2>
            <p className="text-muted-foreground mt-1">Elevation and depth</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { name: 'XS', class: 'shadow-xs' },
              { name: 'SM', class: 'shadow-sm' },
              { name: 'MD', class: 'shadow-md' },
              { name: 'LG', class: 'shadow-lg' },
              { name: 'XL', class: 'shadow-xl' },
              { name: '2XL', class: 'shadow-2xl' },
            ].map((shadow) => (
              <div key={shadow.name} className="flex flex-col items-center gap-2">
                <div
                  className={`w-20 h-20 bg-card rounded-lg ${shadow.class}`}
                />
                <span className="text-sm font-medium text-foreground">{shadow.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Components Preview */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Components</h2>
            <p className="text-muted-foreground mt-1">UI components using the design tokens</p>
          </div>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Button variants and sizes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon"><Sun className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Badge variants for status and labels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>Alert variants for different message types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Default Alert</AlertTitle>
                <AlertDescription>
                  This is a default alert message.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Something went wrong. Please try again.
                </AlertDescription>
              </Alert>

              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  Your changes have been saved successfully.
                </AlertDescription>
              </Alert>

              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Please review before proceeding.
                </AlertDescription>
              </Alert>

              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  Here's some helpful information.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Cards</CardTitle>
              <CardDescription>Card component example</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Card Title</CardTitle>
                    <CardDescription>Card description goes here</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      This is the card content area.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Another Card</CardTitle>
                    <CardDescription>With different content</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">Action Button</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status Card</CardTitle>
                    <CardDescription>Showing badge usage</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Badge variant="success">Active</Badge>
                    <Badge variant="secondary">Pending</Badge>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Radio Group */}
          <Card>
            <CardHeader>
              <CardTitle>Radio Group</CardTitle>
              <CardDescription>Radio button selection</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup defaultValue="option-1">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-1" id="option-1" />
                  <label htmlFor="option-1" className="text-sm font-medium text-foreground">
                    Option 1
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-2" id="option-2" />
                  <label htmlFor="option-2" className="text-sm font-medium text-foreground">
                    Option 2
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-3" id="option-3" />
                  <label htmlFor="option-3" className="text-sm font-medium text-foreground">
                    Option 3
                  </label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </section>

        {/* Spacing */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Spacing</h2>
            <p className="text-muted-foreground mt-1">Consistent spacing scale</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[
                  { name: '0.5', value: '0.125rem', px: '2px' },
                  { name: '1', value: '0.25rem', px: '4px' },
                  { name: '2', value: '0.5rem', px: '8px' },
                  { name: '3', value: '0.75rem', px: '12px' },
                  { name: '4', value: '1rem', px: '16px' },
                  { name: '5', value: '1.25rem', px: '20px' },
                  { name: '6', value: '1.5rem', px: '24px' },
                  { name: '8', value: '2rem', px: '32px' },
                  { name: '10', value: '2.5rem', px: '40px' },
                  { name: '12', value: '3rem', px: '48px' },
                  { name: '16', value: '4rem', px: '64px' },
                ].map((space) => (
                  <div key={space.name} className="flex items-center gap-4">
                    <span className="w-12 text-sm text-muted-foreground">{space.name}</span>
                    <div
                      className="h-4 bg-primary rounded"
                      style={{ width: space.value }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {space.value} ({space.px})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            BFIN Design System v1.0 - Built with Tailwind CSS v4 and shadcn/ui
          </p>
        </footer>
      </div>
    </div>
  )
}
