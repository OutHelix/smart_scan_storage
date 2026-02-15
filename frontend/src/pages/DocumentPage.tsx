import { useParams } from 'react-router-dom'

export function DocumentPage() {
  const { id } = useParams()
  return <p>Document view {id}</p>
}
