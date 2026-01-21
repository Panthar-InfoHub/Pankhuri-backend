export default function Certificate({ name = "Gagan", course = "Btech", date = "", mode = "dev" }) {
  const ribbonImgUrl = "https://res.cloudinary.com/dq6ubifli/image/upload/v1753638293/ribbon_aqdxld.png"

  return (
    <div id="certificate-design" style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'white',
      margin: 0,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // Add print-specific sizing
      // '@media print': {
      //   width: '297mm',
      //   height: '210mm'
      // }
    }}>
      <div style={{
        width: '95%', // Use more available width
        height: '90%', // Control height
        border: '1px solid #d1d5db',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Section - Dark Blue */}
        <div style={{
          backgroundColor: '#040159',
          color: 'white',
          textAlign: 'center',
          padding: '32px 16px', // Reduced padding
          position: 'relative',
          zIndex: 10,
          flex: '0 0 auto'
        }}>
          <h2 style={{
            fontSize: '24px', // Reduced size
            fontFamily: 'serif',
            letterSpacing: '0.25em',
            marginBottom: '4px',
            margin: '0 0 4px 0'
          }}>
            ACADMA
          </h2>
          <h1 style={{
            fontFamily: "'Merriweather', serif",
            fontSize: '80px', // Reduced from 128px
            fontWeight: 'bold',
            fontStyle: 'italic',
            lineHeight: '1',
            marginBottom: '8px',
            margin: '0 0 8px 0'
          }}>
            Certificate
          </h1>
          <p style={{
            fontSize: '18px', // Reduced size
            fontFamily: 'serif',
            letterSpacing: '0.25em',
            margin: '0'
          }}>
            OF APPRECIATION
          </p>
        </div>

        {/* Gold Ribbon Shapes */}
        <div style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          height: '32px', // Reduced height
          marginTop: '-2px'
        }}>
          <div style={{
            backgroundColor: '#c8b100',
            width: '48%',
            height: '100%',
            clipPath: 'polygon(0 0, 100% 0, 90% 60%, 0% 60%)'
          }}></div>
          <div style={{
            backgroundColor: '#c8b100',
            width: '48%',
            height: '100%',
            clipPath: 'polygon(10% 60%, 100% 60%, 100% 0, 0 0)'
          }}></div>
        </div>

        {/* Middle Section - White */}
        <div style={{
          backgroundColor: 'white',
          textAlign: 'center',
          padding: '32px 16px', // Reduced padding
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <p style={{
            fontSize: '22px', // Reduced size
            fontFamily: 'serif',
            marginBottom: '24px',
            margin: '0 0 24px 0'
          }}>
            This certificate is proudly presented to
          </p>
          <div style={{
            borderBottom: '1px solid #9ca3af',
            width: '75%',
            margin: '0 auto 32px auto',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px', // Reduced size
            fontWeight: 'bold',
            color: '#040159'
          }}>
            {name}
          </div>
          <p style={{
            fontSize: '22px', // Reduced size
            fontFamily: 'serif',
            marginBottom: '12px',
            margin: '0 0 12px 0'
          }}>
            For Successful Completion of The Course
          </p>
          <p style={{
            fontFamily: 'serif',
            fontSize: '36px', // Reduced from 48px
            fontWeight: 'bold',
            margin: '0',
            color: '#040159'
          }}>
            {course}
          </p>
        </div>

        {/* Bottom Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px 16px', // Reduced padding
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '24px',
          flexDirection: 'row',
          flexWrap: 'nowrap', // Prevent wrapping
          flex: '0 0 auto'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              borderBottom: '1px solid #9ca3af',
              width: '160px', // Reduced width
              marginBottom: '6px',
              height: '85px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {date}
            </div>
            <p style={{
              fontSize: '16px',
              fontFamily: 'serif',
              margin: '0'
            }}>
              Date
            </p>
          </div>

          <div style={{
            position: 'relative',
          }}>
            <img
              src={mode === "server" ? ribbonImgUrl : "/ribbon.png"}
              alt="Award ribbon seal"
              style={{
                width: "6rem", // Reduced size
                height: "8rem",
                objectFit: "cover"
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>

            <div style={{
              borderBottom: '1px solid #9ca3af',
              width: '160px', // Reduced width
              marginBottom: '6px',
              height: '85px'
            }}>
              <img
                src={"https://res.cloudinary.com/dq6ubifli/image/upload/v1753808839/sign_o2v6wk.png"}
                alt="Signature"
                style={{
                  width: "100%", // Reduced size
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            </div>
            <p style={{
              fontSize: '16px',
              fontFamily: 'serif',
              margin: '0'
            }}>
              Signature
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
