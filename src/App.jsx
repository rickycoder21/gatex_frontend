import React, { useState, useEffect, useRef } from 'react';

// Connect to local backend if running locally, otherwise production
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : 'https://demo.railway.internal';

// Date & Time formatting helpers
const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

function App() {
  // Session Authentication State
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('gatex_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Login Form States (4 Tabs: guard, admin [Society Manager], owner [Society Flat Owner], superadmin)
  const [loginRole, setLoginRole] = useState('guard');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSocietyReg, setLoginSocietyReg] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Societies directory
  const [societies, setSocieties] = useState([]);
  const [socLoading, setSocLoading] = useState(false);

  // Current society data
  const [currentSociety, setCurrentSociety] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // --- SUPER ADMIN STATES ---
  const [newSocName, setNewSocName] = useState('');
  const [newSocReg, setNewSocReg] = useState('');
  const [newSocAddress, setNewSocAddress] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('admin');
  const [newUserSocReg, setNewUserSocReg] = useState('');
  const [usersList, setUsersList] = useState([]);

  // --- SOCIETY MANAGER (ADMIN) STATES ---
  const [managerActiveTab, setManagerActiveTab] = useState('flats'); // 'flats' | 'guards_members' | 'logs' | 'branding'
  const [newGuardName, setNewGuardName] = useState('');
  const [newGuardUsername, setNewGuardUsername] = useState('');
  const [newGuardPassword, setNewGuardPassword] = useState('');
  const [guardsList, setGuardsList] = useState([]);
  const [membersList, setMembersList] = useState([]);

  // Wing & Flat Generator States
  const [genWing, setGenWing] = useState('Wing A');
  const [genMode, setGenMode] = useState('standard'); // 'standard' | 'custom'
  const [genFloors, setGenFloors] = useState(4);
  const [genFlatsPerFloor, setGenFlatsPerFloor] = useState(4);
  const [genCustomList, setGenCustomList] = useState('101, 102, 103, 104, 201, 202, 203, 204');
  const [genDefaultPassword, setGenDefaultPassword] = useState('123456');
  const [flatsList, setFlatsList] = useState([]);
  const [flatsLoading, setFlatsLoading] = useState(false);
  const [flatFilterStatus, setFlatFilterStatus] = useState('ALL');

  // --- SOCIETY FLAT OWNER STATES (POST-LOGIN DETAILS & CREDENTIALS) ---
  const [ownerProfileFlat, setOwnerProfileFlat] = useState(null);
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editOwnerPhone, setEditOwnerPhone] = useState('');
  const [editOwnerEmail, setEditOwnerEmail] = useState('');
  const [editResidentsCount, setEditResidentsCount] = useState(1);
  const [editVehicles, setEditVehicles] = useState('');
  const [editResidentType, setEditResidentType] = useState('Owner');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerSaveSuccess, setOwnerSaveSuccess] = useState(false);

  // --- GUARD PORTAL STATES (CAMERA & CHECK-IN) ---
  const [visName, setVisName] = useState('');
  const [visPhone, setVisPhone] = useState('');
  const [visPurpose, setVisPurpose] = useState('Guest');
  const [visDestination, setVisDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [capturedPhotoBlob, setCapturedPhotoBlob] = useState(null);
  const [showFlash, setShowFlash] = useState(false);

  // Shared Visitor Log states (used by Manager, Guard, and Flat Owner views)
  const [visitors, setVisitors] = useState([]);
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(12);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  // System clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);

  // Live system clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch societies on mount for login auto-fill
  useEffect(() => {
    fetchSocieties();
  }, []);

  // Fetch society-specific data when society is known
  useEffect(() => {
    if (user?.societyRegNumber) {
      fetchSocietyDetails(user.societyRegNumber);
      fetchFlats(user.societyRegNumber);
    }
  }, [user?.societyRegNumber]);

  // Fetch role-specific data on login/role change
  useEffect(() => {
    if (!user) {
      stopCamera();
      setVisitors([]);
      setTotalVisitors(0);
      return;
    }

    if (user.role === 'superadmin') {
      fetchSocieties();
      fetchUsers();
    } else if (user.role === 'admin') {
      fetchGuardsAndMembers();
      fetchFlats(user.societyRegNumber);
      fetchVisitorLogs(true);
    } else if (user.role === 'owner') {
      fetchOwnerProfileAndLogs();
    } else if (user.role === 'guard') {
      startCamera();
      fetchFlats(user.societyRegNumber);
      fetchVisitorLogs(true);
    }

    return () => {
      stopCamera();
    };
  }, [user]);

  
  // Connect media stream to video element whenever stream changes or component re-renders
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('Video play interrupted or autoplay prevented:', err);
      });
    }
  }, [stream, isCameraActive]);

  // Debounced search trigger for logs
  useEffect(() => {
    if (!user || user.role === 'superadmin') return;
    const delayDebounce = setTimeout(() => {
      fetchVisitorLogs(true);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  /* ==========================================================================
     API DATA FETCHING UTILITIES
     ========================================================================== */

  const fetchSocieties = async () => {
    setSocLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/societies`);
      if (res.ok) {
        const data = await res.json();
        setSocieties(data);
      }
    } catch (err) {
      console.error('Error fetching societies:', err);
    } finally {
      setSocLoading(false);
    }
  };

  const fetchSocietyDetails = async (regNumber) => {
    if (!regNumber) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/societies/${regNumber}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSociety(data);
      }
    } catch (err) {
      console.error('Error fetching society details:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchGuardsAndMembers = async () => {
    if (!user?.societyRegNumber) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users?societyRegNumber=${user.societyRegNumber}`);
      if (res.ok) {
        const data = await res.json();
        setGuardsList(data.filter(u => u.role === 'guard'));
        setMembersList(data.filter(u => u.role === 'owner'));
      }
    } catch (err) {
      console.error('Error fetching guards and members:', err);
    }
  };

  const fetchFlats = async (socReg) => {
    const reg = socReg || user?.societyRegNumber;
    if (!reg) return;
    setFlatsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/flats?societyRegNumber=${reg}`);
      if (res.ok) {
        const data = await res.json();
        setFlatsList(data);
      }
    } catch (err) {
      console.error('Error fetching flats:', err);
    } finally {
      setFlatsLoading(false);
    }
  };

  const fetchOwnerProfileAndLogs = async () => {
    if (!user?.societyRegNumber) return;
    try {
      const resFlats = await fetch(`${API_BASE_URL}/api/flats?societyRegNumber=${user.societyRegNumber}`);
      if (resFlats.ok) {
        const allFlats = await resFlats.json();
        const myFlat = allFlats.find(f => f.ownerId === user.id || f.ownerUsername === user.username || f._id === user.flatId);
        if (myFlat) {
          setOwnerProfileFlat(myFlat);
          setEditOwnerName(myFlat.ownerName || (user.name && !user.name.startsWith('Resident of') ? user.name : ''));
          setEditOwnerPhone(myFlat.ownerPhone || user.phone || '');
          setEditOwnerEmail(myFlat.ownerEmail || user.email || '');
          setEditResidentsCount(myFlat.residentsCount || 1);
          setEditVehicles(myFlat.vehicleNumbers || '');
          setEditResidentType(myFlat.residentType || 'Owner');

          fetchVisitorLogsForDestination(myFlat.fullFlatCode || myFlat.flatNumber);
        }
      }
    } catch (err) {
      console.error('Error fetching owner profile:', err);
    }
  };

  const fetchVisitorLogsForDestination = async (flatCode) => {
    if (!user?.societyRegNumber || !flatCode) return;
    setLogsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/visitors?societyRegNumber=${user.societyRegNumber}&destination=${encodeURIComponent(flatCode)}&search=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setVisitors(data.logs || []);
        setTotalVisitors(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching flat visitor logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchVisitorLogs = async (reset = false, customOffset = null) => {
    if (!user?.societyRegNumber) return;

    if (user.role === 'owner') {
      const flatCode = ownerProfileFlat?.fullFlatCode || ownerProfileFlat?.flatNumber || user.flat?.fullFlatCode;
      if (flatCode) {
        return fetchVisitorLogsForDestination(flatCode);
      }
    }

    setLogsLoading(true);
    const targetOffset = customOffset !== null ? customOffset : (reset ? 0 : offset);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/visitors?societyRegNumber=${user.societyRegNumber}&limit=${limit}&offset=${targetOffset}&search=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setVisitors(data.logs || []);
          setOffset(0);
        } else {
          setVisitors((prev) => [...prev, ...(data.logs || [])]);
          setOffset(targetOffset);
        }
        setTotalVisitors(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching visitor logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleLoadMoreLogs = () => {
    if (logsLoading || visitors.length >= totalVisitors) return;
    const nextOffset = offset + limit;
    fetchVisitorLogs(false, nextOffset);
  };

  /* ==========================================================================
     AUTHENTICATION OPERATIONS
     ========================================================================== */

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
          role: loginRole,
          societyRegNumber: loginRole === 'superadmin' ? undefined : loginSocietyReg.toUpperCase().trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('gatex_user', JSON.stringify(data));
        setUser(data);
        setLoginUsername('');
        setLoginPassword('');
        setLoginSocietyReg('');
      } else {
        setLoginError(data.error || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      console.error('Login connection error:', err);
      setLoginError('Could not connect to authentication server. Verify server is running.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gatex_user');
    setUser(null);
    setCurrentSociety(null);
    setOwnerProfileFlat(null);
  };

  /* ==========================================================================
     SOCIETY MANAGER (ADMIN) OPERATIONS
     ========================================================================== */

  // Upload Society Logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.societyRegNumber) return;

    setLogoUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/societies/${user.societyRegNumber}/logo`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        alert('Society Logo updated successfully!');
        fetchSocietyDetails(user.societyRegNumber);
      } else {
        alert(data.error || 'Failed to upload logo.');
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      alert('Network error while uploading logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Bulk Generate Building Wings & Flats
  const handleGenerateFlats = async (e) => {
    e.preventDefault();
    if (!user?.societyRegNumber) return;

    try {
      const body = {
        societyRegNumber: user.societyRegNumber,
        wing: genWing.trim(),
        defaultPassword: genDefaultPassword || '123456'
      };

      if (genMode === 'standard') {
        body.floorsCount = genFloors;
        body.flatsPerFloor = genFlatsPerFloor;
      } else {
        body.customFlatNumbers = genCustomList.split(',').map(s => s.trim()).filter(Boolean);
      }

      const res = await fetch(`${API_BASE_URL}/api/flats/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Flats generated successfully with login accounts!');
        fetchFlats(user.societyRegNumber);
        fetchGuardsAndMembers();
      } else {
        alert(data.error || 'Failed to generate flats.');
      }
    } catch (err) {
      console.error('Flat generation error:', err);
      alert('Server error generating flats.');
    }
  };

  // Delete a Flat
  const handleDeleteFlat = async (flatId, flatCode) => {
    if (!window.confirm(`Are you sure you want to delete flat ${flatCode}?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/flats/${flatId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setFlatsList(prev => prev.filter(f => f._id !== flatId));
        fetchGuardsAndMembers();
        alert(`Flat ${flatCode} deleted.`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete flat.');
      }
    } catch (err) {
      alert('Communication error.');
    }
  };

  // Register Guard
  const handleCreateGuard = async (e) => {
    e.preventDefault();
    if (!newGuardName || !newGuardUsername || !newGuardPassword) {
      alert('Please fill out all guard details.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newGuardUsername.toLowerCase().trim(),
          password: newGuardPassword,
          role: 'guard',
          name: newGuardName,
          societyRegNumber: user.societyRegNumber
        })
      });

      const data = await res.json();
      if (res.ok) {
        setNewGuardName('');
        setNewGuardUsername('');
        setNewGuardPassword('');
        alert(`Security guard ${data.name} registered on roster!`);
        fetchGuardsAndMembers();
      } else {
        alert(data.error || 'Failed to register guard.');
      }
    } catch (err) {
      alert('Server communication error.');
    }
  };

  // Delete User (Guard or Member)
  const handleDeleteUser = async (userId, userName, roleLabel) => {
    if (!window.confirm(`Delete ${roleLabel} account for "${userName}"?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert(`${roleLabel} removed successfully.`);
        fetchGuardsAndMembers();
        fetchFlats(user.societyRegNumber);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Server communication error.');
    }
  };

  // Delete Visitor Log Entry
  const handleDeleteVisitorLog = async (logId, visitorName) => {
    if (!window.confirm(`Are you sure you want to permanently delete visitor record for "${visitorName}"?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/visitors/${logId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setVisitors(prev => prev.filter(v => (v._id || v.id) !== logId));
        setTotalVisitors(prev => Math.max(0, prev - 1));
        if (selectedVisitor && (selectedVisitor._id || selectedVisitor.id) === logId) {
          setSelectedVisitor(null);
        }
        alert('Visitor entry deleted.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete entry.');
      }
    } catch (err) {
      alert('Server communication error.');
    }
  };

  /* ==========================================================================
     SOCIETY FLAT OWNER OPERATIONS (FILL DETAILS & CHANGE PASSWORD AFTER LOGIN)
     ========================================================================== */

  const handleSaveOwnerProfile = async (e) => {
    e.preventDefault();
    if (!ownerProfileFlat?._id) return;

    setOwnerSaving(true);
    setOwnerSaveSuccess(false);

    try {
      const body = {
        ownerName: editOwnerName,
        ownerPhone: editOwnerPhone,
        ownerEmail: editOwnerEmail,
        residentsCount: editResidentsCount,
        vehicleNumbers: editVehicles,
        residentType: editResidentType
      };

      if (editNewPassword && editNewPassword.trim()) {
        body.newPassword = editNewPassword.trim();
      }

      const res = await fetch(`${API_BASE_URL}/api/flats/${ownerProfileFlat._id}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        setOwnerProfileFlat(data.flat);
        setOwnerSaveSuccess(true);
        setEditNewPassword('');
        alert('Resident details and login credentials saved successfully!');
        
        // Update current local user session display name
        if (editOwnerName) {
          const updatedUser = { ...user, name: editOwnerName, phone: editOwnerPhone, email: editOwnerEmail };
          localStorage.setItem('gatex_user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      } else {
        alert(data.error || 'Failed to update flat details.');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Error updating details.');
    } finally {
      setOwnerSaving(false);
    }
  };

  /* ==========================================================================
     SUPER ADMIN OPERATIONS
     ========================================================================== */

  
  const handleDeleteSociety = async (socId, socName, regNumber) => {
    if (!window.confirm(`Are you sure you want to permanently delete society "${socName} (${regNumber})" and all its associated flats, staff, residents, and visitor records?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/societies/${socId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSocieties(prev => prev.filter(s => s._id !== socId));
        alert(`Society "${socName}" deleted successfully.`);
        fetchSocieties();
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete society.');
      }
    } catch (err) {
      alert('Server communication error.');
    }
  };

  const handleCreateSociety = async (e) => {
    e.preventDefault();
    if (!newSocName || !newSocReg || !newSocAddress) {
      alert('All society fields are required.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/societies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSocName,
          registrationNumber: newSocReg.toUpperCase().trim(),
          address: newSocAddress
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSocieties(prev => [...prev, data]);
        setNewSocName('');
        setNewSocReg('');
        setNewSocAddress('');
        alert('Society successfully registered!');
      } else {
        alert(data.error || 'Failed to create society.');
      }
    } catch (err) {
      alert('Server communication error.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName || !newUserUsername || !newUserPassword || !newUserRole) {
      alert('Fill in all user account fields.');
      return;
    }
    if (newUserRole !== 'superadmin' && !newUserSocReg) {
      alert('Manager and Guard accounts must be assigned to a registered Society.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUserUsername.toLowerCase().trim(),
          password: newUserPassword,
          role: newUserRole,
          name: newUserName,
          societyRegNumber: newUserRole === 'superadmin' ? undefined : newUserSocReg.toUpperCase().trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUsersList(prev => [...prev, data]);
        setNewUserName('');
        setNewUserUsername('');
        setNewUserPassword('');
        setNewUserSocReg('');
        alert(`Account created successfully for ${data.name}!`);
      } else {
        alert(data.error || 'Failed to create user account.');
      }
    } catch (err) {
      alert('Server communication error.');
    }
  };

    /* ==========================================================================
     WEBCAM SNAPSHOT OPERATIONS (GUARD ONLY) - BULLETPROOF & HIGH RES
     ========================================================================== */

  const startCamera = async () => {
    setCameraError('');
    setCapturedPhotoUrl(null);
    setCapturedPhotoBlob(null);

    // Stop any existing stream first
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      setStream(mediaStream);
      setIsCameraActive(true);

      // Attach immediately if video element is already mounted
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.log('Play err:', e));
      }
    } catch (err) {
      console.error('Camera stream error:', err);
      setIsCameraActive(false);
      setCameraError('Webcam access unavailable or permission denied. You can upload a photo file below.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    try {
      // 1. If ImageCapture is natively supported, capture crisp hardware photo
      const track = stream?.getVideoTracks?.()[0];
      if (window.ImageCapture && track && track.readyState === 'live') {
        try {
          const imageCapture = new window.ImageCapture(track);
          const photoBlob = await imageCapture.takePhoto();
          if (photoBlob && photoBlob.size > 0) {
            setCapturedPhotoUrl(URL.createObjectURL(photoBlob));
            setCapturedPhotoBlob(photoBlob);
            setShowFlash(true);
            setTimeout(() => setShowFlash(false), 300);
            stopCamera();
            return;
          }
        } catch (imgCapErr) {
          console.warn('Native ImageCapture failed, using canvas frame capture fallback:', imgCapErr);
        }
      }

      // 2. High-performance canvas drawing fallback
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');

      // Clear & set background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, vw, vh);

      // Mirror horizontally so snapshot matches what the user sees in preview
      ctx.save();
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, vw, vh);
      ctx.restore();

      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 300);

      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          setCapturedPhotoUrl(URL.createObjectURL(blob));
          setCapturedPhotoBlob(blob);
          stopCamera();
        } else {
          // Fallback to dataURL if toBlob returned empty
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          fetch(dataUrl)
            .then(res => res.blob())
            .then(b => {
              setCapturedPhotoUrl(dataUrl);
              setCapturedPhotoBlob(b);
              stopCamera();
            });
        }
      }, 'image/jpeg', 0.9);
    } catch (err) {
      console.error('Error capturing photo:', err);
      alert('Could not capture frame. Please try clicking "Launch Webcam" or upload a photo.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedPhotoUrl(URL.createObjectURL(file));
    setCapturedPhotoBlob(file);
    stopCamera();
  };

  const handleVisitorSubmit = async (e) => {
    e.preventDefault();
    if (!visName || !visPhone || !visPurpose || !visDestination) {
      alert('All visitor details are required.');
      return;
    }
    if (!capturedPhotoBlob) {
      alert('Please capture or upload a visitor snapshot before entry.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('name', visName);
    formData.append('phone', visPhone);
    formData.append('purpose', visPurpose);
    formData.append('destination', visDestination);
    formData.append('societyRegNumber', user.societyRegNumber);
    formData.append('photo', capturedPhotoBlob, 'visitor.jpg');

    try {
      const res = await fetch(`${API_BASE_URL}/api/visitors`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert('Access Granted! Visitor log recorded.');
        setVisName('');
        setVisPhone('');
        setVisPurpose('Guest');
        setVisDestination('');
        setCapturedPhotoUrl(null);
        setCapturedPhotoBlob(null);

        await fetchVisitorLogs(true);
        startCamera();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Failed to submit. Code: ${res.status}`);
      }
    } catch (err) {
      console.error('Visitor submit error:', err);
      alert('Could not upload visitor log.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ==========================================================================
     1. LOGGED OUT: 4-TAB LOGIN SCREEN (SIMPLE & UNIFIED)
     ========================================================================== */

  if (!user) {
    return (
      <div className="login-page-container">
        <div className="login-card">
          <div className="login-header">
            <div className="brand-logo-circle">G</div>
            <h2>GateX Terminal</h2>
            <p>Society Visitor Security & Tenancy Portal</p>
          </div>

          {/* 4 Login Tabs */}
          <div className="role-tabs four-tabs">
            <button
              type="button"
              className={`role-tab ${loginRole === 'guard' ? 'active' : ''}`}
              onClick={() => { setLoginRole('guard'); setLoginError(''); }}
            >
              Guard
            </button>
            <button
              type="button"
              className={`role-tab ${loginRole === 'admin' ? 'active' : ''}`}
              onClick={() => { setLoginRole('admin'); setLoginError(''); }}
            >
              Society Manager
            </button>
            <button
              type="button"
              className={`role-tab ${loginRole === 'owner' ? 'active' : ''}`}
              onClick={() => { setLoginRole('owner'); setLoginError(''); }}
            >
              Flat Owner
            </button>
            <button
              type="button"
              className={`role-tab ${loginRole === 'superadmin' ? 'active' : ''}`}
              onClick={() => { setLoginRole('superadmin'); setLoginError(''); }}
            >
              SuperAdmin
            </button>
          </div>

          {/* Error Banner */}
          {loginError && <div className="auth-error-banner">{loginError}</div>}

          {/* Quick Auto-fill Society Code (For Guard, Manager, and Owner) */}
          {loginRole !== 'superadmin' && societies.length > 0 && (
            <div className="soc-quick-container">
              <span className="soc-quick-label">Quick Auto-fill Society Code:</span>
              <div className="soc-quick-tags">
                {societies.map(soc => (
                  <button
                    key={soc._id}
                    type="button"
                    className={`soc-pill-tag ${loginSocietyReg === soc.registrationNumber ? 'active' : ''}`}
                    onClick={() => {
                      setLoginSocietyReg(soc.registrationNumber);
                    }}
                  >
                    {soc.name} ({soc.registrationNumber})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Flat Owner Information Box */}
          {loginRole === 'owner' && (
            <div className="owner-login-hint-card">
              <span className="hint-title">🔑 Flat Owner Access:</span>
              <p>Log in using your <strong>Flat Number</strong> (e.g. <code>A-101</code> or <code>101</code>) and default password (<code>123456</code>). You can fill your resident details and change password after logging in.</p>
            </div>
          )}

          {/* Unified Login Form for All 4 Roles */}
          <form onSubmit={handleLogin} className="login-form">
            {loginRole !== 'superadmin' && (
              <div className="form-group">
                <label htmlFor="login-soc-reg">Society Registration Code</label>
                <input
                  id="login-soc-reg"
                  type="text"
                  placeholder="e.g. PH123"
                  className="form-control"
                  value={loginSocietyReg}
                  onChange={(e) => setLoginSocietyReg(e.target.value.toUpperCase())}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login-username">
                {loginRole === 'owner' ? 'Flat Number / Username' : 'Username'}
              </label>
              <input
                id="login-username"
                type="text"
                placeholder={loginRole === 'owner' ? 'e.g. A-101 or 101' : 'Enter username'}
                className="form-control"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder={loginRole === 'owner' ? 'Default: 123456' : 'Enter password'}
                className="form-control"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loginLoading}
            >
              {loginLoading ? 'Authenticating...' : `Login as ${loginRole === 'admin' ? 'Society Manager' : loginRole === 'owner' ? 'Flat Owner' : loginRole.toUpperCase()}`}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ==========================================================================
     2. LOGGED IN: APPLICATION SHELL & PORTALS
     ========================================================================== */

  const societyLogo = currentSociety?.logoUrl || user?.societyLogoUrl;

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand">
          {societyLogo ? (
            <img src={`${API_BASE_URL}${societyLogo}`} alt="Society Logo" className="society-header-logo" />
          ) : (
            <div className="brand-icon">G</div>
          )}
          <div>
            <h1 className="brand-name">{currentSociety?.name || 'GateX'}</h1>
            <span className="brand-subtitle">
              {user.role === 'superadmin' && 'GLOBAL ROOT MASTER'}
              {user.role === 'admin' && `SOCIETY MANAGER | ${currentSociety?.name || user.societyRegNumber}`}
              {user.role === 'owner' && `FLAT RESIDENT | ${ownerProfileFlat?.fullFlatCode || user.flat?.fullFlatCode || 'Flat'} | ${currentSociety?.name || user.societyRegNumber}`}
              {user.role === 'guard' && `GUARD CHECKPOINT | ${currentSociety?.name || user.societyRegNumber}`}
            </span>
          </div>
        </div>

        <div className="header-right-tools">
          <div className="live-badge">
            <span className="pulse-dot"></span>
            {user.role === 'superadmin' ? 'SYSTEM ACTIVE' : `${user.name.toUpperCase()} ON PORTAL`}
          </div>
          <div className="system-time">
            {currentTime.toLocaleDateString()} | {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button onClick={handleLogout} className="btn btn-danger btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      {/* ==================== 2A. SUPER ADMIN VIEW ==================== */}
      {user.role === 'superadmin' && (
        <main className="dashboard-container superadmin-grid">
          {/* Add Society */}
          <section className="panel card">
            <div className="panel-title">
              <div>
                <h2>Add New Society Tenancy</h2>
                <p className="panel-subtitle">Register residential society or corporate complex</p>
              </div>
            </div>

            <form onSubmit={handleCreateSociety} className="panel-form">
              <div className="form-group">
                <label>Society / Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pine Heights Apartments"
                  className="form-control"
                  value={newSocName}
                  onChange={(e) => setNewSocName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Unique Registration Code</label>
                <input
                  type="text"
                  placeholder="e.g. PH123"
                  className="form-control"
                  value={newSocReg}
                  onChange={(e) => setNewSocReg(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group">
                <label>Address Location</label>
                <input
                  type="text"
                  placeholder="e.g. Sansom Street, Sector 4"
                  className="form-control"
                  value={newSocAddress}
                  onChange={(e) => setNewSocAddress(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block">
                Create Society Profile
              </button>
            </form>

            <div className="panel-list-section">
              <h3 className="section-heading">Registered Societies ({societies.length})</h3>
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Logo</th>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Address</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {societies.map(soc => (
                      <tr key={soc._id}>
                        <td>
                          {soc.logoUrl ? (
                            <img src={`${API_BASE_URL}${soc.logoUrl}`} alt="logo" className="mini-table-logo" />
                          ) : (
                            <span className="logo-placeholder">🏢</span>
                          )}
                        </td>
                        <td className="table-cell-bold">{soc.name}</td>
                        <td><span className="code-badge">{soc.registrationNumber}</span></td>
                        <td className="table-cell-sub">{soc.address}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleDeleteSociety(soc._id, soc.name, soc.registrationNumber)}
                            title="Delete society"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Provision Accounts */}
          <section className="panel card">
            <div className="panel-title">
              <div>
                <h2>Provision User Account</h2>
                <p className="panel-subtitle">Create Society Managers and staff</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="panel-form">
              <div className="form-group">
                <label>Representative Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className="form-control"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Assign Username</label>
                  <input
                    type="text"
                    placeholder="e.g. johndoe"
                    className="form-control"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value.toLowerCase())}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Assign Password</label>
                  <input
                    type="text"
                    placeholder="e.g. pass123"
                    className="form-control"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>System Role</label>
                  <select
                    className="form-control"
                    value={newUserRole}
                    onChange={(e) => {
                      setNewUserRole(e.target.value);
                      if (e.target.value === 'superadmin') setNewUserSocReg('');
                    }}
                  >
                    <option value="admin">Society Manager (Admin)</option>
                    <option value="guard">Security Guard</option>
                    <option value="owner">Society Flat Owner</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Associate Society</label>
                  <select
                    className="form-control"
                    value={newUserSocReg}
                    onChange={(e) => setNewUserSocReg(e.target.value)}
                    disabled={newUserRole === 'superadmin'}
                    required={newUserRole !== 'superadmin'}
                  >
                    <option value="">-- Choose Society --</option>
                    {societies.map(soc => (
                      <option key={soc._id} value={soc.registrationNumber}>
                        {soc.name} ({soc.registrationNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-success btn-block">
                Provision Account Access
              </button>
            </form>

            <div className="panel-list-section">
              <h3 className="section-heading">System Accounts ({usersList.length})</h3>
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Society</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u._id || u.id}>
                        <td className="table-cell-bold">{u.name}</td>
                        <td>@{u.username}</td>
                        <td>
                          <span className={`role-badge role-${u.role}`}>
                            {u.role === 'admin' ? 'MANAGER' : u.role.toUpperCase()}
                          </span>
                        </td>
                        <td><span className="code-badge">{u.societyRegNumber || 'GLOBAL'}</span></td>
                        <td>
                          {u.role !== 'superadmin' && (
                            <button
                              type="button"
                              className="btn-action-delete"
                              onClick={() => handleDeleteUser(u._id || u.id, u.name, 'User')}
                              title="Delete user account"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ==================== 2B. SOCIETY MANAGER (ADMIN) DASHBOARD ==================== */}
      {user.role === 'admin' && (
        <main className="dashboard-container manager-container">
          {/* Navigation Bar inside Society Manager */}
          <div className="manager-subnav">
            <button
              type="button"
              className={`subnav-pill ${managerActiveTab === 'flats' ? 'active' : ''}`}
              onClick={() => setManagerActiveTab('flats')}
            >
              🏢 Building Wings & Flats ({flatsList.length})
            </button>
            <button
              type="button"
              className={`subnav-pill ${managerActiveTab === 'guards_members' ? 'active' : ''}`}
              onClick={() => setManagerActiveTab('guards_members')}
            >
              👥 Guards & Members ({guardsList.length + membersList.length})
            </button>
            <button
              type="button"
              className={`subnav-pill ${managerActiveTab === 'logs' ? 'active' : ''}`}
              onClick={() => setManagerActiveTab('logs')}
            >
              📋 Gate Entry Logs ({totalVisitors})
            </button>
            <button
              type="button"
              className={`subnav-pill ${managerActiveTab === 'branding' ? 'active' : ''}`}
              onClick={() => setManagerActiveTab('branding')}
            >
              🖼️ Society Logo & Branding
            </button>
          </div>

          {/* TAB 1: BUILDING WINGS & FLATS GENERATOR */}
          {managerActiveTab === 'flats' && (
            <div className="manager-tab-content grid-two-col">
              {/* Generator Form */}
              <section className="panel card">
                <div className="panel-title">
                  <div>
                    <h2>Generate Building Wings & Flats</h2>
                    <p className="panel-subtitle">Generates flats and automatically provisions credentials (same username format & default password)</p>
                  </div>
                </div>

                <form onSubmit={handleGenerateFlats} className="panel-form">
                  <div className="form-group">
                    <label>Building Wing / Tower Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Wing A, Tower 1, Block C"
                      className="form-control"
                      value={genWing}
                      onChange={(e) => setGenWing(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Generation Method</label>
                    <div className="role-selection-row">
                      <button
                        type="button"
                        className={`role-option-btn ${genMode === 'standard' ? 'active' : ''}`}
                        onClick={() => setGenMode('standard')}
                      >
                        Floors & Flats per floor
                      </button>
                      <button
                        type="button"
                        className={`role-option-btn ${genMode === 'custom' ? 'active' : ''}`}
                        onClick={() => setGenMode('custom')}
                      >
                        Custom Flat Numbers
                      </button>
                    </div>
                  </div>

                  {genMode === 'standard' ? (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Total Number of Floors</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="form-control"
                          value={genFloors}
                          onChange={(e) => setGenFloors(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Flats per Floor</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          className="form-control"
                          value={genFlatsPerFloor}
                          onChange={(e) => setGenFlatsPerFloor(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Enter Flat Numbers (Comma Separated)</label>
                      <textarea
                        rows="3"
                        className="form-control form-textarea"
                        placeholder="e.g. 101, 102, 103, 104, 201, 202, Penthouse 1"
                        value={genCustomList}
                        onChange={(e) => setGenCustomList(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Default Initial Password for All Flats</label>
                    <input
                      type="text"
                      placeholder="e.g. 123456"
                      className="form-control"
                      value={genDefaultPassword}
                      onChange={(e) => setGenDefaultPassword(e.target.value)}
                      required
                    />
                    <span className="form-hint">Residents can change their details & password after logging in.</span>
                  </div>

                  <div className="gen-preview-box">
                    <span className="gen-preview-label">Sample Generated Credentials:</span>
                    <div className="gen-preview-tags">
                      <span className="code-badge">Login: {genWing}-101 | Pass: {genDefaultPassword || '123456'}</span>
                      <span className="code-badge">Login: {genWing}-102 | Pass: {genDefaultPassword || '123456'}</span>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-block">
                    ⚡ Generate Flats & Auto-Provision Logins
                  </button>
                </form>
              </section>

              {/* Flats Directory */}
              <section className="panel card">
                <div className="panel-title">
                  <div>
                    <h2>Society Flats Directory ({flatsList.length})</h2>
                    <p className="panel-subtitle">Overview of all flats, resident profiles & status</p>
                  </div>
                  <div className="filter-pills">
                    <select
                      className="form-control form-control-sm"
                      value={flatFilterStatus}
                      onChange={(e) => setFlatFilterStatus(e.target.value)}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="vacant">Vacant (Not Filled Yet)</option>
                      <option value="occupied">Occupied (Details Filled)</option>
                    </select>
                  </div>
                </div>

                <div className="flats-grid-container">
                  {flatsLoading ? (
                    <div className="loading-state">Loading flats directory...</div>
                  ) : flatsList.length === 0 ? (
                    <div className="empty-state-text">No flats generated yet. Use the generator on the left to add building wings.</div>
                  ) : (
                    <div className="flats-grid">
                      {flatsList
                        .filter(f => flatFilterStatus === 'ALL' || f.status === flatFilterStatus)
                        .map(flat => (
                          <div key={flat._id} className={`flat-card flat-${flat.status}`}>
                            <div className="flat-card-header">
                              <span className="flat-number-tag">{flat.fullFlatCode || `${flat.wing ? flat.wing + '-' : ''}${flat.flatNumber}`}</span>
                              <span className={`status-pill status-${flat.status}`}>
                                {flat.status === 'occupied' ? 'FILLED' : 'UNFILLED'}
                              </span>
                            </div>
                            <div className="flat-card-body">
                              {flat.status === 'occupied' && flat.ownerName ? (
                                <>
                                  <div className="flat-owner-name">{flat.ownerName}</div>
                                  <div className="flat-owner-phone">📞 {flat.ownerPhone || 'No phone'}</div>
                                  {flat.residentType && <div className="flat-resident-badge">{flat.residentType}</div>}
                                </>
                              ) : (
                                <div className="flat-vacant-text">Default login active (Awaiting resident details)</div>
                              )}
                            </div>
                            <div className="flat-card-footer">
                              <button
                                type="button"
                                className="btn-flat-delete"
                                onClick={() => handleDeleteFlat(flat._id, flat.fullFlatCode || flat.flatNumber)}
                                title="Delete flat"
                              >
                                &times; Delete
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: GUARDS & MEMBERS MANAGEMENT (VIEW / DELETE) */}
          {managerActiveTab === 'guards_members' && (
            <div className="manager-tab-content grid-two-col">
              {/* Guards Section */}
              <section className="panel card">
                <div className="panel-title">
                  <div>
                    <h2>Security Guards ({guardsList.length})</h2>
                    <p className="panel-subtitle">Register and manage checkpoint gatekeepers</p>
                  </div>
                </div>

                <form onSubmit={handleCreateGuard} className="panel-form mb-4">
                  <div className="form-group">
                    <label>Guard Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Officer Smith"
                      className="form-control"
                      value={newGuardName}
                      onChange={(e) => setNewGuardName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Login Username</label>
                      <input
                        type="text"
                        placeholder="e.g. guardsmith"
                        className="form-control"
                        value={newGuardUsername}
                        onChange={(e) => setNewGuardUsername(e.target.value.toLowerCase())}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Login Password</label>
                      <input
                        type="text"
                        placeholder="Assign password"
                        className="form-control"
                        value={newGuardPassword}
                        onChange={(e) => setNewGuardPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-block">
                    + Register Security Guard
                  </button>
                </form>

                <div className="staff-roster-section">
                  <h3 className="section-heading">Active Guard Staff</h3>
                  {guardsList.length === 0 ? (
                    <div className="empty-state-text">No guards registered yet.</div>
                  ) : (
                    <div className="staff-list">
                      {guardsList.map(guard => (
                        <div key={guard._id || guard.id} className="staff-card">
                          <div className="staff-info">
                            <div className="staff-name">👮‍♂️ {guard.name}</div>
                            <div className="staff-sub">@{guard.username}</div>
                          </div>
                          <button
                            type="button"
                            className="btn-danger-outline"
                            onClick={() => handleDeleteUser(guard._id || guard.id, guard.name, 'Guard')}
                          >
                            Delete Guard
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Members / Flat Owners Section */}
              <section className="panel card">
                <div className="panel-title">
                  <div>
                    <h2>Society Flat Logins & Members ({membersList.length})</h2>
                    <p className="panel-subtitle">View active flat accounts and enrolled residents</p>
                  </div>
                </div>

                {membersList.length === 0 ? (
                  <div className="empty-state-text">No flat accounts created yet. Generate building wings & flats in the Flats tab.</div>
                ) : (
                  <div className="staff-list member-scroll-list">
                    {membersList.map(member => (
                      <div key={member._id || member.id} className="staff-card">
                        <div className="staff-info">
                          <div className="staff-name">🏠 {member.fullFlatCode || member.flatNumber || member.name}</div>
                          <div className="staff-sub">
                            Username: <strong>{member.username}</strong> {member.name && !member.name.startsWith('Resident of') ? `(${member.name})` : ''} {member.phone ? `| 📞 ${member.phone}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-danger-outline"
                          onClick={() => handleDeleteUser(member._id || member.id, member.name, 'Member')}
                        >
                          Delete Account
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: GATE ENTRY LOGS (VIEW / DELETE) */}
          {managerActiveTab === 'logs' && (
            <section className="panel card logs-panel">
              <div className="panel-title">
                <div>
                  <h2>Society Gate Entry Logs ({totalVisitors})</h2>
                  <p className="panel-subtitle">View and delete checkpoint entries</p>
                </div>
              </div>

              {/* Search Toolbar */}
              <div className="log-toolbar">
                <div className="search-wrapper">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by visitor name, phone, flat/destination, purpose..."
                    className="form-control search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchVisitorLogs(true)}
                  disabled={logsLoading}
                  className="btn btn-secondary btn-icon"
                  title="Refresh logs"
                >
                  🔄
                </button>
              </div>

              {/* Logs Display */}
              {logsLoading && visitors.length === 0 ? (
                <div className="loading-state">Querying database logs...</div>
              ) : visitors.length === 0 ? (
                <div className="empty-state-card">
                  <h3>No matching visitor records</h3>
                  <p>Check-ins will appear here as guards log them at the gate.</p>
                </div>
              ) : (
                <div className="logs-container">
                  <div className="logs-grid">
                    {visitors.map(visitor => (
                      <div
                        key={visitor._id || visitor.id}
                        className="visitor-card"
                        onClick={() => setSelectedVisitor(visitor)}
                      >
                        <div className="card-img-wrapper">
                          <img
                            src={`${API_BASE_URL}${visitor.photoUrl}`}
                            alt={visitor.name}
                            className="card-img"
                            loading="lazy"
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Snapshot'; }}
                          />
                          <span className={`purpose-badge purpose-${(visitor.purpose || 'guest').toLowerCase()}`}>
                            {visitor.purpose}
                          </span>
                        </div>
                        <div className="card-content">
                          <h3 className="visitor-name">{visitor.name}</h3>
                          <div className="visitor-dest">Flat/Destination: {visitor.destination}</div>
                          <div className="visitor-meta-row">
                            <span>📞 {visitor.phone}</span>
                          </div>
                          <div className="visitor-time">
                            {formatDate(visitor.timestamp)} • {formatTime(visitor.timestamp)}
                          </div>
                          <div className="visitor-card-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn-log-delete"
                              onClick={() => handleDeleteVisitorLog(visitor._id || visitor.id, visitor.name)}
                            >
                              🗑️ Delete Record
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {visitors.length < totalVisitors && (
                    <div className="load-more-wrapper">
                      <button
                        type="button"
                        onClick={handleLoadMoreLogs}
                        disabled={logsLoading}
                        className="btn btn-secondary"
                      >
                        {logsLoading ? 'Loading...' : `Load More Logs (${totalVisitors - visitors.length} remaining)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* TAB 4: SOCIETY LOGO & BRANDING */}
          {managerActiveTab === 'branding' && (
            <section className="panel card max-w-xl mx-auto">
              <div className="panel-title">
                <div>
                  <h2>Society Logo & Branding</h2>
                  <p className="panel-subtitle">Upload your society insignia or crest for the portal and resident badges</p>
                </div>
              </div>

              <div className="branding-preview-card">
                <div className="branding-logo-box">
                  {currentSociety?.logoUrl ? (
                    <img src={`${API_BASE_URL}${currentSociety.logoUrl}`} alt="Society Logo" className="branding-logo-img" />
                  ) : (
                    <div className="branding-logo-empty">No Logo Uploaded</div>
                  )}
                </div>

                <div className="branding-info">
                  <h3>{currentSociety?.name || 'Society'}</h3>
                  <p className="text-muted">Code: {currentSociety?.registrationNumber}</p>
                  <p className="text-muted">{currentSociety?.address}</p>
                </div>
              </div>

              <div className="branding-upload-actions">
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={logoUploading}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoUploading ? 'Uploading Logo...' : '📤 Choose Image & Upload Society Logo'}
                </button>
                <span className="form-hint text-center block mt-2">Recommended: PNG or JPG with transparent or light background (square/circular ratio).</span>
              </div>
            </section>
          )}
        </main>
      )}

      {/* ==================== 2C. SOCIETY FLAT OWNER PORTAL ==================== */}
      {user.role === 'owner' && (
        <main className="dashboard-container owner-grid">
          {/* Left Column: My Residence & Post-Login Detail Filling */}
          <section className="panel card">
            <div className="panel-title">
              <div>
                <h2>My Flat Profile & Details</h2>
                <p className="panel-subtitle">
                  {ownerProfileFlat?.fullFlatCode || user.flat?.fullFlatCode || 'Flat'} | {currentSociety?.name || user.societyRegNumber}
                </p>
              </div>
            </div>

            {/* Prompt banner if details not filled yet */}
            {(!ownerProfileFlat?.ownerName || ownerProfileFlat?.status === 'vacant') && (
              <div className="first-time-prompt-banner">
                👋 <strong>Welcome to your residence portal!</strong> Please fill in your resident profile and update your password below.
              </div>
            )}

            {ownerSaveSuccess && (
              <div className="save-success-banner">
                ✅ Resident profile details saved successfully!
              </div>
            )}

            <div className="flat-profile-badge-card">
              <div className="flat-profile-header">
                <div className="flat-number-large">{ownerProfileFlat?.fullFlatCode || user.flat?.fullFlatCode || 'Flat'}</div>
                <span className={`status-pill ${ownerProfileFlat?.ownerName ? 'status-occupied' : 'status-vacant'}`}>
                  {ownerProfileFlat?.ownerName ? (ownerProfileFlat?.residentType || 'Occupied') : 'Details Pending'}
                </span>
              </div>
              <div className="flat-profile-sub">
                Society: <strong>{currentSociety?.name}</strong> ({user.societyRegNumber})
              </div>
            </div>

            <form onSubmit={handleSaveOwnerProfile} className="panel-form mt-4">
              <h3 className="section-heading">Fill / Update Resident Details</h3>

              <div className="form-group">
                <label>Resident Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Resident"
                  className="form-control"
                  value={editOwnerName}
                  onChange={(e) => setEditOwnerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Contact Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    className="form-control"
                    value={editOwnerPhone}
                    onChange={(e) => setEditOwnerPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="name@email.com"
                    className="form-control"
                    value={editOwnerEmail}
                    onChange={(e) => setEditOwnerEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Resident Type</label>
                  <select
                    className="form-control"
                    value={editResidentType}
                    onChange={(e) => setEditResidentType(e.target.value)}
                  >
                    <option value="Owner">Flat Owner</option>
                    <option value="Tenant">Tenant / Resident</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Family Members Count</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={editResidentsCount}
                    onChange={(e) => setEditResidentsCount(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Vehicle Registration Number(s)</label>
                <input
                  type="text"
                  placeholder="e.g. MH 02 AB 1234, MH 02 CD 5678"
                  className="form-control"
                  value={editVehicles}
                  onChange={(e) => setEditVehicles(e.target.value)}
                />
              </div>

              {/* Password Change Section */}
              <div className="form-group credentials-change-box">
                <label>Change Login Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Enter new password to replace default"
                  className="form-control"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                />
                <span className="form-hint">Leave blank to keep your current password.</span>
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={ownerSaving}>
                {ownerSaving ? 'Saving Changes...' : '💾 Save Resident Profile & Password'}
              </button>
            </form>
          </section>

          {/* Right Column: Live Visitors Checked In for this Flat */}
          <section className="panel card logs-panel">
            <div className="panel-title">
              <div>
                <h2>My Flat Visitors ({visitors.length})</h2>
                <p className="panel-subtitle">Real-time gate check-ins arriving at your flat ({ownerProfileFlat?.fullFlatCode || user.flat?.fullFlatCode})</p>
              </div>
            </div>

            {/* Search toolbar */}
            <div className="log-toolbar">
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Search my visitors..."
                  className="form-control search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => fetchOwnerProfileAndLogs()}
                disabled={logsLoading}
                className="btn btn-secondary btn-icon"
                title="Refresh logs"
              >
                🔄
              </button>
            </div>

            {logsLoading ? (
              <div className="loading-state">Checking gate logs...</div>
            ) : visitors.length === 0 ? (
              <div className="empty-state-card">
                <h3>No visitors currently logged for your flat</h3>
                <p>When security registers guests or deliveries for flat {ownerProfileFlat?.fullFlatCode || user.flat?.fullFlatCode}, their photos and check-in details will appear here in real time.</p>
              </div>
            ) : (
              <div className="logs-container">
                <div className="logs-grid">
                  {visitors.map(visitor => (
                    <div
                      key={visitor._id || visitor.id}
                      className="visitor-card"
                      onClick={() => setSelectedVisitor(visitor)}
                    >
                      <div className="card-img-wrapper">
                        <img
                          src={`${API_BASE_URL}${visitor.photoUrl}`}
                          alt={visitor.name}
                          className="card-img"
                          loading="lazy"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Snapshot'; }}
                        />
                        <span className={`purpose-badge purpose-${(visitor.purpose || 'guest').toLowerCase()}`}>
                          {visitor.purpose}
                        </span>
                      </div>
                      <div className="card-content">
                        <h3 className="visitor-name">{visitor.name}</h3>
                        <div className="visitor-meta-row">
                          <span>📞 {visitor.phone}</span>
                        </div>
                        <div className="visitor-time">
                          {formatDate(visitor.timestamp)} • {formatTime(visitor.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ==================== 2D. SECURITY GUARD CHECKPOINT PORTAL ==================== */}
      {user.role === 'guard' && (
        <main className="dashboard-container guard-grid">
          {/* Check-in Desk Form */}
          <section className="panel card">
            <div className="panel-title">
              <div>
                <h2>Register New Gate Access</h2>
                <p className="panel-subtitle">Active Checkpoint Verification Desk</p>
              </div>
            </div>

            <form onSubmit={handleVisitorSubmit} className="panel-form">
              {/* Webcam verification */}
              <div className="form-group">
                <label>Security Photographic Verification</label>
                <div className="camera-viewport">
                  {isCameraActive && !capturedPhotoUrl && (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-feed"
                      onLoadedMetadata={() => {
                        if (videoRef.current) {
                          videoRef.current.play().catch(() => {});
                        }
                      }}
                    />
                  )}
                  {capturedPhotoUrl && (
                    <img src={capturedPhotoUrl} alt="Captured preview" className="camera-preview" />
                  )}
                  {!isCameraActive && !capturedPhotoUrl && (
                    <div className="camera-placeholder">
                      <span>{cameraError || 'Camera is offline'}</span>
                    </div>
                  )}
                  {isCameraActive && !capturedPhotoUrl && (
                    <div className="camera-overlay">
                      <div className="camera-guide-box"></div>
                    </div>
                  )}
                  <div className={`flash-effect ${showFlash ? 'active' : ''}`}></div>
                </div>

                <div className="camera-action-buttons">
                  {isCameraActive && !capturedPhotoUrl && (
                    <button type="button" onClick={capturePhoto} className="btn btn-primary btn-block">
                      📷 Capture Snapshot
                    </button>
                  )}
                  {capturedPhotoUrl && (
                    <button type="button" onClick={() => startCamera()} className="btn btn-secondary btn-block">
                      🔄 Retake Snapshot
                    </button>
                  )}
                  {!isCameraActive && !capturedPhotoUrl && (
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                      <button type="button" onClick={startCamera} className="btn btn-secondary" style={{ flex: 1 }}>
                        📷 Launch Webcam
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ flex: 1 }}>
                        📁 Upload File
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="vis-name">Visitor Full Name</label>
                <input
                  id="vis-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Richard Roe"
                  value={visName}
                  onChange={(e) => setVisName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="vis-phone">Phone Number</label>
                <input
                  id="vis-phone"
                  type="tel"
                  className="form-control"
                  placeholder="e.g. +91 9999999999"
                  value={visPhone}
                  onChange={(e) => setVisPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="vis-dest">Destination Flat / Room Number</label>
                {flatsList.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      id="vis-dest"
                      type="text"
                      className="form-control"
                      placeholder="e.g. A-101"
                      value={visDestination}
                      onChange={(e) => setVisDestination(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <select
                      className="form-control"
                      style={{ width: '140px' }}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setVisDestination(e.target.value);
                      }}
                    >
                      <option value="">Quick Select</option>
                      {flatsList.map(f => (
                        <option key={f._id} value={f.fullFlatCode || f.flatNumber}>
                          {f.fullFlatCode || f.flatNumber} {f.ownerName ? `(${f.ownerName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    id="vis-dest"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Block C - 402"
                    value={visDestination}
                    onChange={(e) => setVisDestination(e.target.value)}
                    required
                  />
                )}
              </div>

              <div className="form-group">
                <label>Purpose of Access</label>
                <div className="role-selection-row">
                  {['Guest', 'Delivery', 'Maintenance', 'Business', 'Other'].map(purp => (
                    <button
                      key={purp}
                      type="button"
                      className={`role-option-btn ${visPurpose === purp ? 'active' : ''}`}
                      onClick={() => setVisPurpose(purp)}
                    >
                      {purp}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !capturedPhotoBlob || !visName || !visPhone || !visDestination}
                className="btn btn-success btn-block btn-lg"
              >
                {submitting ? 'Registering...' : 'Confirm Gate Entry'}
              </button>
            </form>
          </section>

          {/* Right Column: Shift Logs */}
          <section className="panel card logs-panel">
            <div className="panel-title">
              <div>
                <h2>Gate Logs (Active Shift)</h2>
                <p className="panel-subtitle">Showing {visitors.length} of {totalVisitors} Entries</p>
              </div>
            </div>

            <div className="log-toolbar">
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Filter shift entries..."
                  className="form-control search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => fetchVisitorLogs(true)}
                disabled={logsLoading}
                className="btn btn-secondary btn-icon"
                title="Refresh logs"
              >
                🔄
              </button>
            </div>

            {logsLoading && visitors.length === 0 ? (
              <div className="loading-state">Querying database logs...</div>
            ) : visitors.length === 0 ? (
              <div className="empty-state-card">
                <h3>No visitors logged</h3>
                <p>Register visitors at checkpoint to populate the log ledger.</p>
              </div>
            ) : (
              <div className="logs-container">
                <div className="logs-grid">
                  {visitors.map(visitor => (
                    <div
                      key={visitor._id || visitor.id}
                      className="visitor-card"
                      onClick={() => setSelectedVisitor(visitor)}
                    >
                      <div className="card-img-wrapper">
                        <img
                          src={`${API_BASE_URL}${visitor.photoUrl}`}
                          alt={visitor.name}
                          className="card-img"
                          loading="lazy"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Snapshot'; }}
                        />
                        <span className={`purpose-badge purpose-${(visitor.purpose || 'guest').toLowerCase()}`}>
                          {visitor.purpose}
                        </span>
                      </div>
                      <div className="card-content">
                        <h3 className="visitor-name">{visitor.name}</h3>
                        <div className="visitor-dest">Destination: {visitor.destination}</div>
                        <div className="visitor-meta-row">
                          <span>📞 {visitor.phone}</span>
                        </div>
                        <div className="visitor-time">
                          {formatDate(visitor.timestamp)} • {formatTime(visitor.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {visitors.length < totalVisitors && (
                  <div className="load-more-wrapper">
                    <button
                      type="button"
                      onClick={handleLoadMoreLogs}
                      disabled={logsLoading}
                      className="btn btn-secondary"
                    >
                      {logsLoading ? 'Loading...' : `Load More Logs (${totalVisitors - visitors.length} remaining)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="app-footer">
        GateX Security & Tenancy Terminal &copy; {new Date().getFullYear()} — Multi-Tenant Society Portal. All rights reserved.
      </footer>

      {/* ==================== VISITOR DETAIL MODAL ==================== */}
      {selectedVisitor && (
        <div className="modal-backdrop" onClick={() => setSelectedVisitor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Verification Record</h2>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedVisitor(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-photo-wrapper">
                <img
                  src={`${API_BASE_URL}${selectedVisitor.photoUrl}`}
                  alt={selectedVisitor.name}
                  className="modal-photo-large"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=Snapshot'; }}
                />
              </div>

              <div className="modal-meta-list">
                <div className="modal-meta-item">
                  <span className="modal-label">Visitor ID</span>
                  <span className="modal-value modal-code">{(selectedVisitor._id || selectedVisitor.id || '').toUpperCase()}</span>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-label">Visitor Name</span>
                  <span className="modal-value modal-name">{selectedVisitor.name}</span>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-label">Contact Number</span>
                  <span className="modal-value">{selectedVisitor.phone}</span>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-label">Destination Flat / Office</span>
                  <span className="modal-value modal-dest">{selectedVisitor.destination}</span>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-label">Access Purpose</span>
                  <span className={`purpose-badge purpose-${(selectedVisitor.purpose || 'guest').toLowerCase()}`}>
                    {selectedVisitor.purpose}
                  </span>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-label">Gate Check-In Time</span>
                  <span className="modal-value">{formatDate(selectedVisitor.timestamp)} at {formatTime(selectedVisitor.timestamp)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem' }}>
              {user.role === 'admin' && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => handleDeleteVisitorLog(selectedVisitor._id || selectedVisitor.id, selectedVisitor.name)}
                >
                  🗑️ Delete Entry
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setSelectedVisitor(null)}
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;
