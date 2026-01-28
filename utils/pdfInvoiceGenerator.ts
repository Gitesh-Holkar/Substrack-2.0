import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface InvoiceData {
  invoiceId: string
  invoiceDate: string
  dueDate?: string

  // Merchant Info
  merchantName: string
  merchantEmail: string
  merchantAddress?: string
  merchantGST?: string
  merchantPhone?: string
  merchantLogo?: string

  // Customer Info
  customerName: string
  customerEmail: string

  // Payment Info
  planName: string
  planDescription?: string
  amount: number
  currency: string
  status: string

  // Additional Info
  paymentMethod?: string
  transactionId?: string
  billingCycle?: string
}

export const generateInvoicePDF = async (data: InvoiceData) => {
  const doc = new jsPDF()

  // Colors
  const primaryColor: [number, number, number] = [79, 70, 229] // Indigo
  const textColor: [number, number, number] = [55, 65, 81] // Gray-700
  const lightGray: [number, number, number] = [243, 244, 246] // Gray-100

  let currentY = 20

  // HEADER SECTION
  if (data.merchantLogo) {
    try {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = data.merchantLogo
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        setTimeout(reject, 5000) // 5 second timeout
      }).then(() => {
        doc.addImage(img, 'PNG', 20, currentY - 5, 30, 30)
      }).catch(() => {
        console.log('Logo loading failed, continuing without logo')
      })
    } catch (error) {
      console.log('Error loading logo:', error)
    }
  }

  const nameX = data.merchantLogo ? 55 : 20
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  doc.text(data.merchantName, nameX, currentY + 5)

  doc.setFontSize(28)
  doc.setTextColor(...textColor)
  doc.text('INVOICE', 190, currentY + 5, { align: 'right' })

  currentY += (data.merchantLogo ? 35 : 15)

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text(data.merchantEmail, 20, currentY)
  currentY += 5

  if (data.merchantPhone) {
    doc.text(data.merchantPhone, 20, currentY)
    currentY += 5
  }

  if (data.merchantAddress) {
    const addressLines = doc.splitTextToSize(data.merchantAddress, 80)
    doc.text(addressLines, 20, currentY)
    currentY += (addressLines.length * 5)
  }

  if (data.merchantGST) {
    doc.text(`GST: ${data.merchantGST}`, 20, currentY)
    currentY += 5
  }

  currentY = Math.max(currentY, 60)

  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.5)
  doc.line(20, currentY, 190, currentY)

  currentY += 10

  // INVOICE DETAILS
  const detailsStartY = currentY

  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice Number:', 20, currentY)
  doc.setFont('helvetica', 'normal')
  doc.text(data.invoiceId, 60, currentY)

  currentY += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice Date:', 20, currentY)
  doc.setFont('helvetica', 'normal')
  doc.text(data.invoiceDate, 60, currentY)

  if (data.dueDate) {
    currentY += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Due Date:', 20, currentY)
    doc.setFont('helvetica', 'normal')
    doc.text(data.dueDate, 60, currentY)
  }

  currentY += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Status:', 20, currentY)
  doc.setFont('helvetica', 'normal')

  if (data.status === 'success') {
    doc.setTextColor(22, 163, 74)
    doc.text('PAID', 60, currentY)
  } else if (data.status === 'failed') {
    doc.setTextColor(220, 38, 38)
    doc.text('FAILED', 60, currentY)
  } else {
    doc.setTextColor(234, 179, 8)
    doc.text('PENDING', 60, currentY)
  }

  doc.setTextColor(...textColor)

  const rightX = 120
  let rightY = detailsStartY

  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', rightX, rightY)

  rightY += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.customerName, rightX, rightY)

  rightY += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(data.customerEmail, rightX, rightY)

  currentY = Math.max(currentY, rightY) + 15

  doc.setTextColor(...textColor)

  const totalAmount = data.amount
  const baseAmount = totalAmount / 1.18
  const gstAmount = totalAmount - baseAmount

  const tableData = [
    [
      data.planName,
      data.planDescription || data.billingCycle || 'Subscription',
      '1',
      `INR ${baseAmount.toFixed(2)}`,
      `INR ${baseAmount.toFixed(2)}`,
    ],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['Description', 'Details', 'Qty', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 32.5, halign: 'right' },
      4: { cellWidth: 32.5, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10

  const totalsX = 125
  let totalsY = finalY

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', totalsX, totalsY)
  doc.text(`INR ${baseAmount.toFixed(2)}`, 190, totalsY, { align: 'right' })

  totalsY += 6

  doc.text('Tax (18%):', totalsX, totalsY)
  doc.text(`INR ${gstAmount.toFixed(2)}`, 190, totalsY, { align: 'right' })
  totalsY += 6

  doc.setDrawColor(...lightGray)
  doc.line(totalsX, totalsY, 190, totalsY)
  totalsY += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total Amount:', totalsX, totalsY)
  doc.setTextColor(...primaryColor)
  doc.text(`INR ${totalAmount.toFixed(2)}`, 190, totalsY, { align: 'right' })

  doc.setTextColor(...textColor)

  if (data.transactionId || data.paymentMethod) {
    if (totalsY > 240) {
      doc.addPage()
      totalsY = 20
    } else {
      totalsY += 15
    }
      
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Payment Information:', 20, totalsY)

    totalsY += 5
    doc.setFont('helvetica', 'normal')

    if (data.paymentMethod) {
      doc.text(`Payment Method: ${data.paymentMethod}`, 20, totalsY)
      totalsY += 4
    }

    if (data.transactionId) {
      doc.text(`Transaction ID: ${data.transactionId}`, 20, totalsY)
    }
  }

  const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 20

  doc.setDrawColor(...lightGray)
  doc.line(20, footerY, 190, footerY)

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text('Thank you for your business!', 105, footerY + 5, { align: 'center' })
  doc.text(
    'For any queries, please contact us at ' + data.merchantEmail,
    105,
    footerY + 10,
    { align: 'center' }
  )

  doc.save(`${data.invoiceId}.pdf`)
}

export const formatInvoiceDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}